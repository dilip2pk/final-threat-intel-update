const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password, data } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const hash = await bcrypt.hash(password, 10);
    const meta = data || {};

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id, email, raw_user_meta_data, created_at`,
      [email, hash, JSON.stringify(meta)]
    );

    // Create profile
    const displayName = meta.display_name || email.split("@")[0];
    await pool.query(
      `INSERT INTO profiles (id, email, display_name) VALUES ($1, $2, $3)`,
      [user.id, email, displayName]
    );

    // Assign role: first user = admin, rest = user
    const { rows: roleCount } = await pool.query("SELECT count(*) as c FROM user_roles");
    const role = parseInt(roleCount[0].c) === 0 ? "admin" : "user";
    await pool.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`,
      [user.id, role]
    );

    const token = signToken(user);

    res.json({
      user: { id: user.id, email: user.email, user_metadata: meta },
      session: { access_token: token, user: { id: user.id, email: user.email, user_metadata: meta } },
    });
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "User already registered" });
    console.error("Signup error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (rows.length === 0) return res.status(400).json({ error: "Invalid login credentials" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid login credentials" });

    const token = signToken(user);
    const meta = user.raw_user_meta_data || {};

    res.json({
      user: { id: user.id, email: user.email, user_metadata: meta },
      session: { access_token: token, user: { id: user.id, email: user.email, user_metadata: meta } },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/session
router.get("/session", async (req, res) => {
  if (!req.user) return res.json({ user: null, session: null });

  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  if (rows.length === 0) return res.json({ user: null, session: null });

  const user = rows[0];
  const meta = user.raw_user_meta_data || {};
  const token = signToken(user);

  res.json({
    user: { id: user.id, email: user.email, user_metadata: meta },
    session: { access_token: token, user: { id: user.id, email: user.email, user_metadata: meta } },
  });
});

// POST /api/auth/signout
router.post("/signout", (req, res) => {
  res.json({ success: true });
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  // In local mode, just acknowledge — no email sending
  res.json({ success: true, message: "Password reset is not available in local mode. Please contact an administrator." });
});

// PUT /api/auth/user — update password
router.put("/user", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  try {
    const { password } = req.body;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.user.id]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
