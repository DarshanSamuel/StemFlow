/* GET    /api/projects/[id]  — get single project
   DELETE /api/projects/[id]  — delete project + its GridFS stem files */

import { ObjectId } from "mongodb";
import { connectDB, Project, getGridFSBucket } from "../_lib/db.js";
import { verifyToken, apiHandler } from "../_lib/auth.js";

export default apiHandler(async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  // Extract [id] from URL path
  const urlParts = req.url.split("/");
  const projectId = urlParts[urlParts.length - 1]?.split("?")[0];

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required." });
  }

  await connectDB();

  // ---- GET: Single project ----
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

  // ---- DELETE: Remove project + clean up GridFS stems ----
  if (req.method === "DELETE") {
    const project = await Project.findOne({
      _id: projectId,
      userId: decoded.userId,
    }).lean();

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Delete the GridFS stem files
    try {
      const bucket = await getGridFSBucket();
      const stemIds = Object.values(project.stems || {}).filter(Boolean);

      for (const stemId of stemIds) {
        try {
          await bucket.delete(new ObjectId(stemId));
        } catch (err) {
          // File might already be deleted or ID invalid — continue
          console.warn(`Could not delete GridFS file ${stemId}:`, err.message);
        }
      }
    } catch (err) {
      console.warn("GridFS cleanup error:", err.message);
      // Don't fail the request — still delete the project document
    }

    // Delete the project document
    await Project.findByIdAndDelete(projectId);

    return res.status(200).json({ message: "Project and stems deleted." });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
