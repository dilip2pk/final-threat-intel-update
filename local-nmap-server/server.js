#!/usr/bin/env node
/**
 * Local Nmap Backend Server
 * 
 * A standalone Express server that executes real Nmap scans and exposes
 * a REST API compatible with ThreatIntel's Network Scanner.
 * 
 * SETUP:
 *   1. Install Node.js 18+ and Nmap on your system
 *   2. cd local-nmap-server
 *   3. npm install
 *   4. node server.js
 *   (or: NMAP_API_KEY=mysecretkey PORT=3001 node server.js)
 * 
 * ENVIRONMENT VARIABLES:
 *   PORT           - Server port (default: 3001)
 *   NMAP_API_KEY   - Optional API key for authentication
 *   NMAP_PATH      - Path to nmap binary (default: "nmap")
 * 
 * ENDPOINTS:
 *   POST /api/scan          - Start a scan (returns results synchronously)
 *   POST /api/scan/async    - Start a scan (returns immediately, poll for results)
 *   GET  /api/scan/:id      - Get scan status/results
 *   GET  /api/health        - Health check
 */

const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const { randomUUID } = require("crypto");
const { parseString } = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.NMAP_API_KEY || "";
const NMAP_PATH = process.env.NMAP_PATH || "nmap";

// In-memory scan store (for async scans)
const scanStore = new Map();

app.use(cors());
app.use(express.json());

// Optional API key auth middleware
function authMiddleware(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (provided !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}

app.use("/api", authMiddleware);

// Health check
app.get("/api/health", (req, res) => {
  exec(`${NMAP_PATH} --version`, (err, stdout) => {
    if (err) {
      return res.json({ status: "error", nmap: false, message: "Nmap not found. Install nmap and ensure it's in PATH." });
    }
    const version = stdout.split("\n")[0] || stdout.trim();
    res.json({ status: "ok", nmap: true, version, timestamp: new Date().toISOString() });
  });
});

// Build nmap command from params
function buildNmapCommand(params) {
  const { targets, scanType, ports, timingTemplate, enableScripts, customOptions } = params;
  const parts = [NMAP_PATH];

  // Timing
  if (timingTemplate) parts.push(`-${timingTemplate}`);

  // Scan type flags
  switch (scanType) {
    case "quick": parts.push("-F"); break;
    case "full": parts.push("-p-"); break;
    case "service": parts.push("-sV"); break;
    case "vuln": parts.push("-sV"); if (enableScripts !== false) parts.push("--script=vuln"); break;
    case "custom": break;
    default: parts.push("-F");
  }

  // Custom ports
  if (ports && scanType !== "full") {
    parts.push(`-p ${ports}`);
  }

  // Scripts
  if (enableScripts && scanType !== "vuln") {
    parts.push("--script=default,vuln");
  }

  // OS detection (needs root/admin)
  parts.push("-O --osscan-guess");

  // Custom options
  if (customOptions) parts.push(customOptions);

  // XML output
  parts.push("-oX -");

  // Targets
  const targetList = Array.isArray(targets) ? targets : [targets];
  parts.push(...targetList.map(t => t.trim()).filter(Boolean));

  return parts.join(" ");
}

// Parse nmap XML output
function parseNmapXML(xml) {
  return new Promise((resolve, reject) => {
    parseString(xml, { explicitArray: false, mergeAttrs: true }, (err, result) => {
      if (err) return reject(err);

      const nmaprun = result?.nmaprun;
      if (!nmaprun) return resolve({ hosts: [], summary: {} });

      const hostsRaw = nmaprun.host ? (Array.isArray(nmaprun.host) ? nmaprun.host : [nmaprun.host]) : [];

      const hosts = hostsRaw.map(h => {
        const addr = h.address ? (Array.isArray(h.address) ? h.address : [h.address]) : [];
        const ip = addr.find(a => a.addrtype === "ipv4")?.addr || addr[0]?.addr || "unknown";
        const mac = addr.find(a => a.addrtype === "mac");
        const hostStatus = h.status?.state || "unknown";

        // OS detection
        let osDetection = null;
        if (h.os?.osmatch) {
          const matches = Array.isArray(h.os.osmatch) ? h.os.osmatch : [h.os.osmatch];
          osDetection = matches.slice(0, 3).map(m => ({
            name: m.name,
            accuracy: m.accuracy,
          }));
        }

        // Ports
        const portsRaw = h.ports?.port ? (Array.isArray(h.ports.port) ? h.ports.port : [h.ports.port]) : [];
        const ports = portsRaw.map(p => {
          const scripts = p.script ? (Array.isArray(p.script) ? p.script : [p.script]) : [];
          return {
            port: parseInt(p.portid),
            protocol: p.protocol || "tcp",
            state: p.state?.state || "unknown",
            service: p.service?.name || "unknown",
            version: [p.service?.product, p.service?.version, p.service?.extrainfo].filter(Boolean).join(" ") || "",
            scripts: scripts.map(s => ({ id: s.id, output: s.output })),
          };
        });

        // Vulnerabilities from scripts
        const vulnerabilities = [];
        for (const p of portsRaw) {
          const scripts = p.script ? (Array.isArray(p.script) ? p.script : [p.script]) : [];
          for (const s of scripts) {
            if (s.id && (s.id.includes("vuln") || s.output?.includes("VULNERABLE"))) {
              vulnerabilities.push({
                port: parseInt(p.portid),
                script: s.id,
                output: s.output,
                severity: s.output?.includes("VULNERABLE") ? "high" : "medium",
              });
            }
          }
        }

        return {
          host: ip,
          host_status: hostStatus === "up" ? "up" : "down",
          mac: mac?.addr || null,
          os_detection: osDetection,
          ports: ports.filter(p => p.state === "open"),
          all_ports: ports,
          vulnerabilities,
        };
      });

      // Summary
      const runstats = nmaprun.runstats;
      const summary = {
        total_hosts: hosts.length,
        hosts_up: hosts.filter(h => h.host_status === "up").length,
        hosts_down: hosts.filter(h => h.host_status === "down").length,
        total_open_ports: hosts.reduce((acc, h) => acc + h.ports.length, 0),
        total_closed_ports: hosts.reduce((acc, h) => acc + h.all_ports.filter(p => p.state !== "open").length, 0),
        elapsed: runstats?.finished?.elapsed || "0",
        scan_time: runstats?.finished?.timestr || new Date().toISOString(),
        nmap_version: nmaprun.version || "unknown",
        command: nmaprun.args || "",
      };

      resolve({ hosts, summary });
    });
  });
}

// Execute scan
async function executeScan(params) {
  const cmd = buildNmapCommand(params);
  console.log(`[nmap] Executing: ${cmd}`);

  return new Promise((resolve, reject) => {
    const timeout = parseInt(params.timeout) || 300; // 5 min default
    const child = exec(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: timeout * 1000 }, async (err, stdout, stderr) => {
      if (err && !stdout) {
        return reject(new Error(`Nmap execution failed: ${err.message}. ${stderr || ""}`));
      }
      try {
        const parsed = await parseNmapXML(stdout);
        resolve({
          ...parsed,
          raw_xml: stdout,
          stderr: stderr || null,
          command: cmd,
        });
      } catch (parseErr) {
        reject(new Error(`Failed to parse nmap output: ${parseErr.message}`));
      }
    });
  });
}

// Synchronous scan endpoint
app.post("/api/scan", async (req, res) => {
  const { targets, scanType, ports, timingTemplate, enableScripts, customOptions } = req.body;

  if (!targets || (Array.isArray(targets) && targets.length === 0)) {
    return res.status(400).json({ error: "No targets specified" });
  }

  const scanId = randomUUID();
  const startTime = new Date().toISOString();

  try {
    const result = await executeScan({ targets, scanType, ports, timingTemplate, enableScripts, customOptions });

    res.json({
      success: true,
      scanId,
      started_at: startTime,
      completed_at: new Date().toISOString(),
      summary: result.summary,
      results: result.hosts.map(h => ({
        host: h.host,
        host_status: h.host_status,
        os_detection: h.os_detection,
        ports: h.ports,
        vulnerabilities: h.vulnerabilities,
      })),
      command: result.command,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, scanId });
  }
});

// Async scan endpoint
app.post("/api/scan/async", async (req, res) => {
  const { scanId: providedId, targets, scanType, ports, timingTemplate, enableScripts, customOptions } = req.body;

  if (!targets || (Array.isArray(targets) && targets.length === 0)) {
    return res.status(400).json({ error: "No targets specified" });
  }

  const scanId = providedId || randomUUID();
  scanStore.set(scanId, { status: "running", started_at: new Date().toISOString() });

  // Return immediately
  res.json({ success: true, scanId, status: "running" });

  // Execute in background
  try {
    const result = await executeScan({ targets, scanType, ports, timingTemplate, enableScripts, customOptions });
    scanStore.set(scanId, {
      status: "completed",
      started_at: scanStore.get(scanId)?.started_at,
      completed_at: new Date().toISOString(),
      summary: result.summary,
      results: result.hosts.map(h => ({
        host: h.host,
        host_status: h.host_status,
        os_detection: h.os_detection,
        ports: h.ports,
        vulnerabilities: h.vulnerabilities,
      })),
      command: result.command,
    });
  } catch (err) {
    scanStore.set(scanId, {
      status: "failed",
      error: err.message,
      started_at: scanStore.get(scanId)?.started_at,
      completed_at: new Date().toISOString(),
    });
  }
});

// Get scan status/results
app.get("/api/scan/:id", (req, res) => {
  const scan = scanStore.get(req.params.id);
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  res.json(scan);
});

// List recent scans
app.get("/api/scans", (req, res) => {
  const scans = [];
  for (const [id, data] of scanStore.entries()) {
    scans.push({ id, ...data });
  }
  res.json(scans.slice(-50).reverse());
});

app.listen(PORT, () => {
  console.log(`\n🔒 ThreatIntel Local Nmap Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Auth: ${API_KEY ? "API key required" : "No authentication (set NMAP_API_KEY to enable)"}`);
  console.log(`   Nmap: ${NMAP_PATH}`);
  console.log(`\n   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Scan endpoint: http://localhost:${PORT}/api/scan\n`);
});
