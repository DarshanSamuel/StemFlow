/* GET /api/auth/me */

import { connectDB, User } from "../_lib/db.js";
import { verifyToken, apiHandler } from "../_lib/auth.js";

export default apiHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  await connectDB();

  const user = await User.findById(decoded.userId).select("-passwordHash");
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.status(200).json({
    user: {
      id: user._id,
      email: user.email,
    },
  });
});
