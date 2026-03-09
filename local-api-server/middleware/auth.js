const jwt = require("jsonwebtoken");
const pool = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

async function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Fetch role
    const { rows } = await pool.query(
      "SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1",
      [payload.sub]
    );
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: rows[0]?.role || "user",
    };
  } catch {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

module.exports = { authMiddleware, requireAuth, requireAdmin, JWT_SECRET };
