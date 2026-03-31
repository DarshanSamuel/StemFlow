/* GET    /api/projects/[id]  — get single project
   DELETE /api/projects/[id]  — delete project + its GridFS stem files */

import { connectDB, Project, getNativeDB } from "../_lib/db.js";
import { verifyToken, apiHandler } from "../_lib/auth.js";

export default apiHandler(async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  // On Vercel, dynamic route params come from req.query
  // For /api/projects/[id].js → req.query.id
  // Fallback to URL parsing for local dev
  let projectId = req.query?.id;
  if (!projectId) {
    const urlParts = req.url.split("/");
    projectId = urlParts[urlParts.length - 1]?.split("?")[0];
  }

  if (!projectId || projectId.length < 10) {
    return res.status(400).json({ error: "Project ID is required." });
  }

  await connectDB();

  // ---- GET ----
  if (req.method === "GET") {
    const project = await Project.findOne({
      _id: projectId,
      userId: decoded.userId,
    }).lean();

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    return res.status(200).json({ project });
  }

  // ---- DELETE ----
  if (req.method === "DELETE") {
    const project = await Project.findOne({
      _id: projectId,
      userId: decoded.userId,
    }).lean();

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Clean up GridFS stem files using raw collection operations
    // (avoids GridFSBucket compatibility issues)
    try {
      const db = await getNativeDB();
      const stemIds = Object.values(project.stems || {}).filter(Boolean);

      for (const stemIdStr of stemIds) {
        try {
          const { ObjectId } = await import("mongodb");
          const stemOid = new ObjectId(stemIdStr);

          // Delete from stems.files
          await db.collection("stems.files").deleteOne({ _id: stemOid });
          // Delete all chunks for this file
          await db.collection("stems.chunks").deleteMany({ files_id: stemOid });
        } catch (err) {
          console.warn(`Could not delete stem ${stemIdStr}:`, err.message);
        }
      }
    } catch (err) {
      console.warn("Stem cleanup error:", err.message);
    }

    // Delete the project document
    await Project.findByIdAndDelete(projectId);

    return res.status(200).json({ message: "Project and stems deleted." });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
