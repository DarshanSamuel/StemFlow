/* GET /api/projects   — list user's projects
   POST /api/projects  — create new project (stems = GridFS file IDs) */

import { ObjectId } from "mongodb";
import { connectDB, Project, getGridFSBucket } from "../_lib/db.js";
import { verifyToken, apiHandler } from "../_lib/auth.js";

export default apiHandler(async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  await connectDB();

  // ---- GET: List projects ----
  if (req.method === "GET") {
    const projects = await Project.find({ userId: decoded.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ projects });
  }

  // ---- POST: Create project ----
  if (req.method === "POST") {
    const { name, stems } = req.body;

    if (!name || !stems) {
      return res
        .status(400)
        .json({ error: "Project name and stems are required." });
    }

    // stems should contain GridFS ObjectId strings, e.g.:
    // { vocals: "66a1b2c3d4e5f6a7b8c9d0e1", drums: "...", bass: "...", other: "..." }
    const project = await Project.create({
      userId: decoded.userId,
      name,
      stems: {
        vocals: stems.vocals || "",
        drums: stems.drums || "",
        bass: stems.bass || "",
        other: stems.other || "",
      },
    });

    return res.status(201).json({ project });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
