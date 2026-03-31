/* ================================================================
   GET /api/stems/[id]
   
   Serves audio stems stored in MongoDB GridFS.
   
   Instead of using GridFSBucket (which can have compatibility
   issues with PyMongo-uploaded files), this reads directly from
   the stems.files and stems.chunks collections for maximum
   reliability.
   ================================================================ */

import { ObjectId } from "mongodb";
import { getNativeDB } from "../_lib/db.js";
import { setCorsHeaders } from "../_lib/auth.js";

export const config = {
  api: {
    responseLimit: false,
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

  // Extract file ID from URL
  const urlParts = req.url.split("/");
  const fileIdStr = urlParts[urlParts.length - 1]?.split("?")[0];

  if (!fileIdStr || fileIdStr.length !== 24) {
    return res.status(400).json({ error: "Invalid stem file ID.", received: fileIdStr });
  }

  try {
    let fileId;
    try {
      fileId = new ObjectId(fileIdStr);
    } catch {
      return res.status(400).json({ error: "Malformed ObjectId." });
    }

    const db = await getNativeDB();

    // ── Step 1: Find the file metadata ──
    const fileMeta = await db.collection("stems.files").findOne({ _id: fileId });

    if (!fileMeta) {
      return res.status(404).json({
        error: "Stem file not found in stems.files.",
        searchedId: fileIdStr,
      });
    }

    const fileSize = fileMeta.length;
    const chunkSize = fileMeta.chunkSize;
    const contentType =
      fileMeta.contentType ||
      fileMeta.metadata?.contentType ||
      "audio/mpeg";

    // ── Step 2: Read ALL chunks sorted by n ──
    const chunks = await db
      .collection("stems.chunks")
      .find({ files_id: fileId })
      .sort({ n: 1 })
      .toArray();

    if (!chunks || chunks.length === 0) {
      return res.status(404).json({
        error: "No chunks found for this file.",
        fileId: fileIdStr,
        expectedChunks: Math.ceil(fileSize / chunkSize),
      });
    }

    // ── Step 3: Assemble the full file buffer ──
    const buffers = chunks.map((chunk) => {
      if (Buffer.isBuffer(chunk.data)) return chunk.data;
      if (chunk.data?.buffer) return Buffer.from(chunk.data.buffer);
      return Buffer.from(chunk.data);
    });

    const fullBuffer = Buffer.concat(buffers);

    // ── Step 4: Handle Range requests (for seeking) ──
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fullBuffer.length - 1;
      const slice = fullBuffer.slice(start, end + 1);

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fullBuffer.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": slice.length,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      return res.end(slice);
    }

    // ── Step 5: Full file response ──
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": fullBuffer.length,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    return res.end(fullBuffer);

  } catch (error) {
    console.error("Stem fetch error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Failed to fetch stem audio.",
        detail: error.message,
      });
    }
  }
}
