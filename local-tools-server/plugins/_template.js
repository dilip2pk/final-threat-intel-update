/**
 * Plugin Template for Local Tools Server
 * 
 * Copy this file and rename it to create a new tool plugin.
 * The filename (without .js) becomes the tool ID.
 * 
 * Required exports:
 *   - metadata   : Object with id, name, description, version, icon, category, requires
 *   - healthCheck: async () => { status, available, version?, message? }
 *   - registerRoutes: (router) => void  — mount endpoints on the Express Router
 * 
 * Optional exports:
 *   - registerLegacyRoutes: (app) => void — backward-compat routes on the main app
 */

// const { exec } = require("child_process");

const metadata = {
  id: "my-tool",                              // Unique tool identifier (lowercase, no spaces)
  name: "My Custom Tool",                     // Display name
  description: "Description of what this tool does",
  version: "1.0.0",
  icon: "🔧",                                 // Emoji icon for UI
  category: "network",                        // Category: network, recon, vuln, forensics, misc
  requires: ["my-binary"],                    // System binaries required (checked on startup)
  envVars: {                                  // Environment variables this plugin uses
    MY_TOOL_PATH: { description: "Path to the binary", default: "my-binary" },
  },
};

/**
 * Health check — verify the tool binary is available and working.
 * @returns {Promise<{status: string, available: boolean, version?: string, message?: string}>}
 */
async function healthCheck() {
  // Example:
  // return new Promise((resolve) => {
  //   exec("my-binary --version", (err, stdout) => {
  //     if (err) resolve({ status: "error", available: false, message: "Binary not found" });
  //     else resolve({ status: "ok", available: true, version: stdout.trim() });
  //   });
  // });
  return { status: "ok", available: true, version: "1.0.0" };
}

/**
 * Register API routes for this tool.
 * Routes are mounted at /api/tools/{tool-id}/
 * 
 * @param {import('express').Router} router - Express router scoped to this tool
 */
function registerRoutes(router) {
  // Example: POST /api/tools/my-tool/execute
  router.post("/execute", async (req, res) => {
    try {
      const { target } = req.body;
      // ... run the tool ...
      res.json({ success: true, results: {} });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Example: GET /api/tools/my-tool/results
  router.get("/results", (req, res) => {
    res.json([]);
  });
}

module.exports = { metadata, healthCheck, registerRoutes };
