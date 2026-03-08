# ThreatIntel — Local Nmap Backend Server

A standalone Node.js server that executes real Nmap scans on your local network and exposes a REST API compatible with ThreatIntel's Network Scanner UI.

## Prerequisites

1. **Node.js 18+** — [https://nodejs.org](https://nodejs.org)
2. **Nmap** installed and in your system PATH:
   - **Linux:** `sudo apt install nmap` or `sudo yum install nmap`
   - **macOS:** `brew install nmap`
   - **Windows:** [https://nmap.org/download.html](https://nmap.org/download.html)
3. **Root/Admin privileges** (required for OS detection and SYN scans)

## Quick Start

```bash
cd local-nmap-server
npm install
sudo node server.js
```

> **Note:** Run with `sudo` (Linux/macOS) or as Administrator (Windows) for full Nmap capabilities (OS detection, SYN scans).

## Environment Variables

| Variable        | Default  | Description                                  |
|-----------------|----------|----------------------------------------------|
| `PORT`          | `3001`   | Server listen port                           |
| `NMAP_API_KEY`  | *(none)* | Optional API key for request authentication  |
| `NMAP_PATH`     | `nmap`   | Path to the nmap binary                      |

### Example with all options:

```bash
NMAP_API_KEY=my-secret-key PORT=3001 NMAP_PATH=/usr/bin/nmap sudo -E node server.js
```

## API Endpoints

### `GET /api/health`
Health check — verifies Nmap is installed and returns version info.

### `POST /api/scan` (Synchronous)
Executes a scan and waits for completion before responding.

```json
{
  "targets": ["192.168.1.1", "10.0.0.0/24"],
  "scanType": "quick",
  "ports": "80,443,8080",
  "timingTemplate": "T3",
  "enableScripts": false
}
```

### `POST /api/scan/async` (Asynchronous)
Returns immediately with a scan ID. Poll `/api/scan/:id` for results.

### `GET /api/scan/:id`
Get status and results of an async scan.

### `GET /api/scans`
List recent scans (in-memory, last 50).

## Connecting to ThreatIntel

1. Start the local server
2. In ThreatIntel, go to **Settings → Network Scanner**
3. Set **Scan Backend** to **Local Nmap Server**
4. Enter your server URL: `http://localhost:3001`
5. (Optional) Enter the API key if you set `NMAP_API_KEY`
6. Click **Test Connection** to verify
7. Save settings

Now all scans from the Network Scanner page will execute real Nmap on your local machine!

## Security Notes

- The server executes system commands — only run on trusted networks
- Use `NMAP_API_KEY` in production environments
- Never expose this server to the public internet without proper authentication
- Consider running behind a reverse proxy (nginx) with TLS for remote access
