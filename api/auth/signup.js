/* POST /api/auth/signup */

import bcrypt from "bcryptjs";
import { connectDB, User } from "../_lib/db.js";
import { generateToken, apiHandler } from "../_lib/auth.js";

export default apiHandler(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;

  // ---- Validation ----
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  await connectDB();

  // ---- Check for existing user ----
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });
  }

  // ---- Create user ----
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    email: email.toLowerCase().trim(),
    passwordHash,
  });

  const token = generateToken(user);

  return res.status(201).json({
    token,
    user: {
      id: user._id,
      email: user.email,
    },
  });
});
