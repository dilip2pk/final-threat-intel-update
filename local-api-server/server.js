#!/usr/bin/env node
/**
 * ThreatIntel Local API Server
 * Replaces Supabase backend with local PostgreSQL + Express
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const { authMiddleware } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const dbRoutes = require("./routes/db");
const storageRoutes = require("./routes/storage");
const functionRoutes = require("./routes/functions");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Auth middleware — sets req.user on all routes
app.use(authMiddleware);

// ── Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/db", dbRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/functions", functionRoutes);

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// ── Start ──
console.log(`\n🔒 ThreatIntel Local API Server v1.0`);
console.log(`   Port: ${PORT}`);
console.log(`   DB: ${process.env.DATABASE_URL ? "configured" : "⚠️  DATABASE_URL not set"}`);
console.log(`\n   Endpoints:`);
console.log(`     Health:     http://localhost:${PORT}/api/health`);
console.log(`     Auth:       http://localhost:${PORT}/api/auth/`);
console.log(`     Database:   http://localhost:${PORT}/api/db/:table`);
console.log(`     Functions:  http://localhost:${PORT}/api/functions/`);
console.log(`     Storage:    http://localhost:${PORT}/api/storage/`);
console.log();

app.listen(PORT);
