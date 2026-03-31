/* POST /api/auth/signin */

import bcrypt from "bcryptjs";
import { connectDB, User } from "../_lib/db.js";
import { generateToken, apiHandler } from "../_lib/auth.js";

export default apiHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  await connectDB();

  // ---- Find user ----
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  // ---- Verify password ----
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = generateToken(user);

  return res.status(200).json({
    token,
    user: {
      id: user._id,
      email: user.email,
    },
  });
});
