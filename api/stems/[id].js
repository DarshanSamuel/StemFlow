/* ================================================================
   GET /api/stems/[id]
   
   Streams an audio stem from MongoDB GridFS to the browser.
   
   Uses buffered reads instead of pipe() for Vercel compatibility.
   Supports Range requests for audio seeking.
   ================================================================ */

import { ObjectId } from "mongodb";
import { getGridFSBucket, getNativeDB } from "../_lib/db.js";
import { setCorsHeaders } from "../_lib/auth.js";

export const config = {
  api: {
    responseLimit: false,
  },
};

/**
 * Read a GridFS file (or a byte range of it) into a Buffer.
 */
function downloadToBuffer(bucket, fileId, options = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = bucket.openDownloadStream(fileId, options);

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err) => reject(err));
  });
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Extract file ID from URL
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

    const db = await getNativeDB();
    const bucket = await getGridFSBucket();

    // Look up file metadata
    const fileMeta = await db
      .collection("stems.files")
      .findOne({ _id: fileId });

    if (!fileMeta) {
      return res.status(404).json({ error: "Stem file not found." });
    }

    const fileSize = fileMeta.length;
    const contentType = fileMeta.metadata?.contentType || "audio/mpeg";

    // ── Handle Range requests (for seeking) ──
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Read the requested byte range into a buffer
      const buffer = await downloadToBuffer(bucket, fileId, {
        start,
        end: end + 1, // GridFS end is exclusive
      });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": buffer.length,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      });

      return res.end(buffer);
    }

    // ── Full file response ──
    const buffer = await downloadToBuffer(bucket, fileId);

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": buffer.length,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    });

    return res.end(buffer);
  } catch (error) {
    console.error("Stem fetch error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to fetch stem audio." });
    }
  }
}
