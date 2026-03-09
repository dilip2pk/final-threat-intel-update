# ThreatIntel — Universal Local Tools Server

A plugin-based Node.js server that executes local security tools and exposes a REST API compatible with ThreatIntel's UI. Ships with **Nmap** and is extensible — add new tools by dropping a plugin file.

## Prerequisites

1. **Node.js 18+** — [https://nodejs.org](https://nodejs.org)
2. **Tool binaries** installed and in PATH (per plugin requirements):
   - **Nmap:** `sudo apt install nmap` / `brew install nmap` / [nmap.org](https://nmap.org/download.html)
3. **Root/Admin privileges** (required for certain Nmap features)

## Quick Start

```bash
cd local-tools-server
npm install
sudo node server.js
```

## Environment Variables

| Variable         | Default  | Description                                    |
|------------------|----------|------------------------------------------------|
| `PORT`           | `3001`   | Server listen port                             |
| `TOOLS_API_KEY`  | *(none)* | Optional API key for all tool requests         |
| `NMAP_API_KEY`   | *(none)* | Alias for TOOLS_API_KEY (backward compat)      |
| `NMAP_PATH`      | `nmap`   | Path to the nmap binary                        |

```bash
TOOLS_API_KEY=my-secret PORT=3001 sudo -E node server.js
```

## API Endpoints

### Global

| Method | Endpoint           | Description                          |
|--------|--------------------|--------------------------------------|
| GET    | `/api/health`      | Server health + all plugin statuses  |
| GET    | `/api/tools`       | List all registered tool plugins     |

### Per-Tool (mounted at `/api/tools/{tool-id}/`)

| Method | Endpoint                              | Description                |
|--------|---------------------------------------|----------------------------|
| GET    | `/api/tools/{id}/health`              | Tool-specific health check |
| POST   | `/api/tools/{id}/execute`             | Synchronous execution      |
| POST   | `/api/tools/{id}/execute/async`       | Async execution            |
| GET    | `/api/tools/{id}/progress/:scanId`    | Progress of async job      |
| GET    | `/api/tools/{id}/result/:scanId`      | Result of async job        |
| GET    | `/api/tools/{id}/results`             | List recent results        |

### Backward Compatibility (Nmap)

The old `/api/scan`, `/api/scan/async`, `/api/scan/:id`, `/api/scans` routes still work.

## Adding a New Tool Plugin

1. Copy `plugins/_template.js` to `plugins/my-tool.js`
2. Implement the three required exports:
   - `metadata` — Tool info (id, name, description, icon, category, requires)
   - `healthCheck()` — Async function to verify the binary is available
   - `registerRoutes(router)` — Mount Express routes for execution
3. Restart the server — the plugin auto-loads

### Plugin Structure

```
plugins/
  _template.js     ← Copy this to create new plugins
  nmap.js          ← Built-in Nmap plugin
  my-tool.js       ← Your custom plugin
```

## Connecting to ThreatIntel

1. Start the local server: `sudo node server.js`
2. In ThreatIntel → **Settings → Local Tools**
3. Enter server URL: `http://localhost:3001`
4. (Optional) Enter the API key if you set `TOOLS_API_KEY`
5. Click **Test Connection** — the server reports all available tools
6. Save settings

## Security Notes

- The server executes system commands — only run on trusted networks
- Use `TOOLS_API_KEY` in production
- Never expose to the public internet without TLS + auth
- Consider running behind a reverse proxy (nginx) for remote access
