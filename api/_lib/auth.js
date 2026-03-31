/* ================================================================
   auth.js — JWT Helpers for Vercel API Routes
   ================================================================ */

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables.");
}

/**
 * Generate a signed JWT token for the given user.
 * @param {{ _id: string, email: string }} user
 * @returns {string} JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Verify and decode a JWT from the Authorization header.
 * Returns the decoded payload or null if invalid.
 * @param {Request} req
 * @returns {{ userId: string, email: string } | null}
 */
export function verifyToken(req) {
  try {
    const authHeader = req.headers.get
      ? req.headers.get("authorization")
      : req.headers?.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

    const token = authHeader.split(" ")[1];
    if (token === "guest") return null; // Guest mode — no auth

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Express-style CORS headers helper for Vercel serverless functions.
 */
export function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

/**
 * Reusable handler wrapper with CORS and error handling.
 */
export function apiHandler(handler) {
  return async (req, res) => {
    setCorsHeaders(res);

    // Handle preflight
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    try {
      return await handler(req, res);
    } catch (error) {
      console.error("API Error:", error);
      return res.status(500).json({
        error: error.message || "Internal server error",
      });
    }
  };
}
