/* ================================================================
   GET /api/stems/[id]
   
   Streams an audio stem from MongoDB GridFS to the browser.
   The [id] is a GridFS ObjectId string stored in the project.
   
   Response: audio/mpeg binary stream with caching headers.
   Supports Range requests for seeking in the audio player.
   ================================================================ */

import { ObjectId } from "mongodb";
import { getGridFSBucket, getNativeDB } from "../_lib/db.js";
import { setCorsHeaders } from "../_lib/auth.js";

export const config = {
  api: {
    responseLimit: false, // Allow large audio responses
  },
};

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Extract file ID from URL path
  const urlParts = req.url.split("/");
  const fileIdStr = urlParts[urlParts.length - 1]?.split("?")[0];

  if (!fileIdStr || fileIdStr.length !== 24) {
    return res.status(400).json({ error: "Invalid stem file ID." });
  }

  try {
    let fileId;
    try {
      fileId = new ObjectId(fileIdStr);
    } catch {
      return res.status(400).json({ error: "Malformed file ID." });
    }

    const bucket = await getGridFSBucket();
    const db = await getNativeDB();

    // Look up the file metadata first to get content-length
    const fileMeta = await db
      .collection("stems.files")
      .findOne({ _id: fileId });

    if (!fileMeta) {
      return res.status(404).json({ error: "Stem file not found." });
    }

    const fileSize = fileMeta.length;
    const contentType = fileMeta.metadata?.contentType || "audio/mpeg";
    const fileName = fileMeta.filename || "stem.mp3";

    // ---- Handle Range requests (for audio seeking) ----
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      });

      const stream = bucket.openDownloadStream(fileId, { start, end: end + 1 });
      stream.pipe(res);

      stream.on("error", (err) => {
        console.error("GridFS stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Stream error" });
        }
      });
    } else {
      // ---- Full file response ----
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": fileSize,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      });

      const stream = bucket.openDownloadStream(fileId);
      stream.pipe(res);

      stream.on("error", (err) => {
        console.error("GridFS stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Stream error" });
        }
      });
    }
  } catch (error) {
    console.error("Stem fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch stem audio." });
  }
}
