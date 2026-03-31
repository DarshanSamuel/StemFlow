/* ================================================================
   GET /api/stems/debug
   
   Temporary debug endpoint — shows what's in stems.files
   so you can verify the data is reachable from Vercel.
   
   DELETE THIS FILE after confirming things work.
   ================================================================ */

import { getNativeDB } from "../_lib/db.js";
import { setCorsHeaders } from "../_lib/auth.js";

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await getNativeDB();

    // Count documents
    const filesCount = await db.collection("stems.files").countDocuments();
    const chunksCount = await db.collection("stems.chunks").countDocuments();

    // Get the 5 most recent files
    const recentFiles = await db
      .collection("stems.files")
      .find({})
      .sort({ uploadDate: -1 })
      .limit(5)
      .project({
        _id: 1,
        filename: 1,
        length: 1,
        chunkSize: 1,
        uploadDate: 1,
        contentType: 1,
        metadata: 1,
      })
      .toArray();

    // For each file, count its chunks
    const filesWithChunkInfo = await Promise.all(
      recentFiles.map(async (file) => {
        const chunkCount = await db
          .collection("stems.chunks")
          .countDocuments({ files_id: file._id });
        return {
          ...file,
          _id: file._id.toString(),
          lengthMB: (file.length / 1048576).toFixed(2),
          expectedChunks: Math.ceil(file.length / (file.chunkSize || 261120)),
          actualChunks: chunkCount,
          streamUrl: `/api/stems/${file._id.toString()}`,
        };
      })
    );

    return res.status(200).json({
      status: "ok",
      database: db.databaseName,
      totalFiles: filesCount,
      totalChunks: chunksCount,
      recentFiles: filesWithChunkInfo,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Debug failed",
      detail: error.message,
    });
  }
}
