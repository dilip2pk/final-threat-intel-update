#!/usr/bin/env node
/**
 * ThreatIntel — Universal Local Tools Server
 * 
 * A plugin-based Express server that discovers and loads tool plugins
 * from the ./plugins directory. Each plugin registers its own routes,
 * health checks, and capabilities.
 * 
 * Adding a new tool:
 *   1. Copy plugins/_template.js to plugins/my-tool.js
 *   2. Implement metadata, healthCheck, and registerRoutes
 *   3. Restart the server — the tool auto-registers
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.TOOLS_API_KEY || process.env.NMAP_API_KEY || "";

app.use(cors());
app.use(express.json());

// --- Plugin Registry ---
const pluginRegistry = new Map();

function loadPlugins() {
  const pluginsDir = path.join(__dirname, "plugins");
  if (!fs.existsSync(pluginsDir)) {
    console.warn("  ⚠️  No plugins directory found");
    return;
  }

  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".js") && !f.startsWith("_"));

  for (const file of files) {
    try {
      const plugin = require(path.join(pluginsDir, file));
      if (!plugin.metadata?.id || !plugin.healthCheck || !plugin.registerRoutes) {
        console.warn(`  ⚠️  Skipping ${file} — missing required exports (metadata, healthCheck, registerRoutes)`);
        continue;
      }

      const id = plugin.metadata.id;
      pluginRegistry.set(id, plugin);

      // Create a sub-router for this plugin
      const router = express.Router();
      plugin.registerRoutes(router);
      app.use(`/api/tools/${id}`, authMiddleware, router);

      // Register legacy routes if provided
      if (plugin.registerLegacyRoutes) {
        plugin.registerLegacyRoutes(app);
      }

      console.log(`  ✅ ${plugin.metadata.icon || "🔧"} ${plugin.metadata.name} (${id}) v${plugin.metadata.version}`);
    } catch (err) {
      console.error(`  ❌ Failed to load plugin ${file}:`, err.message);
    }
  }
}

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (provided !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}

// --- Global endpoints ---

// Health check for the entire server + all plugins
app.get("/api/health", authMiddleware, async (req, res) => {
  const tools = {};
  for (const [id, plugin] of pluginRegistry.entries()) {
    try {
      tools[id] = await plugin.healthCheck();
    } catch (err) {
      tools[id] = { status: "error", available: false, message: err.message };
    }
  }

  const allHealthy = Object.values(tools).every(t => t.available);
  const anyAvailable = Object.values(tools).some(t => t.available);

  res.json({
    status: anyAvailable ? "ok" : "error",
    server_version: "2.0.0",
    tools,
    total_plugins: pluginRegistry.size,
    timestamp: new Date().toISOString(),
    // Backward compat: expose nmap fields at root level
    ...(tools.nmap ? { nmap: tools.nmap.available, version: tools.nmap.version } : {}),
  });
});

// List all registered tools/plugins
app.get("/api/tools", authMiddleware, (req, res) => {
  const tools = [];
  for (const [id, plugin] of pluginRegistry.entries()) {
    tools.push({
      ...plugin.metadata,
      endpoints: {
        health: `/api/tools/${id}/health`,
        base: `/api/tools/${id}`,
      },
    });
  }
  res.json({ tools, total: tools.length });
});

// Per-tool health check
app.get("/api/tools/:toolId/health", authMiddleware, async (req, res) => {
  const plugin = pluginRegistry.get(req.params.toolId);
  if (!plugin) return res.status(404).json({ error: `Tool '${req.params.toolId}' not found` });
  try {
    const health = await plugin.healthCheck();
    res.json({ tool: req.params.toolId, ...health, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ tool: req.params.toolId, status: "error", message: err.message });
  }
});

// --- Start ---
console.log(`\n🔒 ThreatIntel Local Tools Server v2.0`);
console.log(`   Loading plugins...`);
loadPlugins();
console.log(`\n   Port: ${PORT}`);
console.log(`   Auth: ${API_KEY ? "API key required" : "No authentication (set TOOLS_API_KEY to enable)"}`);
console.log(`   Plugins: ${pluginRegistry.size} loaded`);
console.log(`\n   Endpoints:`);
console.log(`     Health:  http://localhost:${PORT}/api/health`);
console.log(`     Tools:   http://localhost:${PORT}/api/tools`);
for (const [id] of pluginRegistry.entries()) {
  console.log(`     ${id}:   http://localhost:${PORT}/api/tools/${id}/`);
}
console.log();

app.listen(PORT);
