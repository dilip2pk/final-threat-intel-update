const express = require("express");
const pool = require("../db");

const router = express.Router();

// Allowed tables (whitelist to prevent SQL injection)
const ALLOWED_TABLES = [
  "profiles", "user_roles", "app_settings", "feed_sources", "alert_rules",
  "scans", "scan_results", "scan_schedules", "generated_reports",
  "email_log", "ticket_log", "ticket_history", "audit_log",
  "watchlist", "shodan_queries", "shodan_results", "top_cves", "scheduled_jobs",
];

function validateTable(table) {
  return ALLOWED_TABLES.includes(table);
}

// Build WHERE clause from query params
function buildWhere(query, startIdx = 1) {
  const filters = [];
  const values = [];
  let idx = startIdx;

  for (const [key, val] of Object.entries(query)) {
    if (["_order", "_ascending", "_limit", "_single", "_select", "_table"].includes(key)) continue;
    filters.push(`"${key}" = $${idx}`);
    values.push(val);
    idx++;
  }

  return { clause: filters.length ? `WHERE ${filters.join(" AND ")}` : "", values, nextIdx: idx };
}

// GET /api/db/:table — SELECT
router.get("/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) return res.status(400).json({ error: `Invalid table: ${table}` });

  try {
    const select = req.query._select || "*";
    const order = req.query._order;
    const ascending = req.query._ascending !== "false";
    const limit = parseInt(req.query._limit) || 1000;
    const single = req.query._single === "true";

    const { clause, values } = buildWhere(req.query);

    let sql = `SELECT ${select} FROM "${table}" ${clause}`;
    if (order) sql += ` ORDER BY "${order}" ${ascending ? "ASC" : "DESC"}`;
    sql += ` LIMIT ${single ? 1 : limit}`;

    const { rows } = await pool.query(sql, values);

    if (single) {
      if (rows.length === 0) return res.json({ data: null, error: null });
      return res.json({ data: rows[0], error: null });
    }
    res.json({ data: rows, error: null });
  } catch (e) {
    console.error(`DB SELECT error (${table}):`, e.message);
    res.json({ data: null, error: { message: e.message } });
  }
});

// POST /api/db/:table — INSERT
router.post("/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) return res.status(400).json({ error: `Invalid table: ${table}` });

  try {
    const body = req.body;
    const returnSingle = req.query._single === "true";
    const keys = Object.keys(body);
    const values = Object.values(body);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (returnSingle) return res.json({ data: rows[0], error: null });
    res.json({ data: rows, error: null });
  } catch (e) {
    console.error(`DB INSERT error (${table}):`, e.message);
    res.json({ data: null, error: { message: e.message } });
  }
});

// PATCH /api/db/:table — UPDATE
router.patch("/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) return res.status(400).json({ error: `Invalid table: ${table}` });

  try {
    const updates = req.body;
    const updateKeys = Object.keys(updates);
    const updateValues = Object.values(updates);

    const setClauses = updateKeys.map((k, i) => `"${k}" = $${i + 1}`);
    const { clause, values: whereValues } = buildWhere(req.query, updateKeys.length + 1);

    const sql = `UPDATE "${table}" SET ${setClauses.join(", ")} ${clause} RETURNING *`;
    const { rows } = await pool.query(sql, [...updateValues, ...whereValues]);

    res.json({ data: rows, error: null });
  } catch (e) {
    console.error(`DB UPDATE error (${table}):`, e.message);
    res.json({ data: null, error: { message: e.message } });
  }
});

// DELETE /api/db/:table — DELETE
router.delete("/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) return res.status(400).json({ error: `Invalid table: ${table}` });

  try {
    const { clause, values } = buildWhere(req.query);
    const sql = `DELETE FROM "${table}" ${clause} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    res.json({ data: rows, error: null });
  } catch (e) {
    console.error(`DB DELETE error (${table}):`, e.message);
    res.json({ data: null, error: { message: e.message } });
  }
});

// POST /api/db/:table/upsert — UPSERT
router.post("/:table/upsert", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) return res.status(400).json({ error: `Invalid table: ${table}` });

  try {
    const body = req.body;
    const conflictCol = req.query._onConflict || "key";
    const keys = Object.keys(body);
    const values = Object.values(body);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const updateClauses = keys.filter(k => k !== conflictCol).map((k, i) => `"${k}" = EXCLUDED."${k}"`);

    const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateClauses.join(", ")} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    res.json({ data: rows, error: null });
  } catch (e) {
    console.error(`DB UPSERT error (${table}):`, e.message);
    res.json({ data: null, error: { message: e.message } });
  }
});

module.exports = router;
