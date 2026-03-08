#!/usr/bin/env node
/**
 * Local Nmap Backend Server
 * 
 * A standalone Express server that executes real Nmap scans and exposes
 * a REST API compatible with ThreatIntel's Network Scanner.
 */

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const { exec } = require("child_process");
const { randomUUID } = require("crypto");
const { parseString } = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.NMAP_API_KEY || "";
const NMAP_PATH = process.env.NMAP_PATH || "nmap";

// In-memory scan store (for async scans)
const scanStore = new Map();
// Progress tracking
const progressStore = new Map();

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
  const { targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand } = params;

  // Raw command mode — user provides the full command
  if (scanType === "raw" && rawCommand) {
    let cmd = rawCommand.trim();
    // Strip any existing -oX flag to avoid conflicts
    cmd = cmd.replace(/-oX\s+\S+/g, "").trim();
    // Ensure it starts with nmap
    if (!cmd.startsWith("nmap") && !cmd.startsWith(NMAP_PATH)) {
      cmd = `${NMAP_PATH} ${cmd}`;
    } else if (cmd.startsWith("nmap") && NMAP_PATH !== "nmap") {
      cmd = cmd.replace(/^nmap/, NMAP_PATH);
    }
    // Append XML output
    cmd += " -oX - --stats-every 3s";
    return cmd;
  }

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

  // XML output + stats for progress
  parts.push("-oX - --stats-every 3s");

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

        let osDetection = null;
        if (h.os?.osmatch) {
          const matches = Array.isArray(h.os.osmatch) ? h.os.osmatch : [h.os.osmatch];
          osDetection = matches.slice(0, 3).map(m => ({
            name: m.name,
            accuracy: m.accuracy,
          }));
        }

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

// Parse progress from nmap stderr output
function parseProgress(stderrLine) {
  // Nmap outputs progress like: "Stats: 0:00:15 elapsed; 0 hosts completed (1 up), 1 undergoing SYN Stealth Scan"
  // Or: "SYN Stealth Scan Timing: About 45.67% done; ETC: 16:35 (0:00:12 remaining)"
  const percentMatch = stderrLine.match(/About\s+([\d.]+)%\s+done/);
  if (percentMatch) {
    return { percent: Math.round(parseFloat(percentMatch[1])), phase: stderrLine.trim() };
  }
  // Also match: "Completed SYN Stealth Scan at 16:35, 25.03s elapsed (1000 total ports)"
  const completedMatch = stderrLine.match(/Completed\s+(.+?)\s+at/);
  if (completedMatch) {
    return { percent: 100, phase: `Completed ${completedMatch[1]}` };
  }
  // Stats line
  const statsMatch = stderrLine.match(/Stats:\s+(.+)/);
  if (statsMatch) {
    return { phase: statsMatch[1].trim() };
  }
  return null;
}

// Execute scan with progress tracking
async function executeScan(params, scanId) {
  const cmd = buildNmapCommand(params);
  console.log(`[nmap] Executing: ${cmd}`);

  // Initialize progress
  if (scanId) {
    progressStore.set(scanId, { percent: 0, phase: "Initializing scan...", startedAt: Date.now() });
  }

  return new Promise((resolve, reject) => {
    const timeout = parseInt(params.timeout) || 600; // 10 min default
    let stdout = "";
    let stderr = "";

    // Use spawn for real-time stderr capture
    const args = cmd.split(/\s+/).slice(1); // Remove the nmap binary from args
    const nmapBin = cmd.split(/\s+/)[0];
    const child = spawn(nmapBin, args, { timeout: timeout * 1000 });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      
      // Parse progress from stderr
      if (scanId) {
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            const progress = parseProgress(line);
            if (progress) {
              const current = progressStore.get(scanId) || {};
              progressStore.set(scanId, {
                ...current,
                ...progress,
                percent: progress.percent ?? current.percent ?? 0,
                lastUpdate: Date.now(),
              });
            }
          }
        }
      }
    });

    child.on("error", (err) => {
      if (scanId) progressStore.delete(scanId);
      reject(new Error(`Nmap execution failed: ${err.message}`));
    });

    child.on("close", async (code) => {
      if (scanId) {
        progressStore.set(scanId, { percent: 100, phase: "Parsing results...", lastUpdate: Date.now() });
      }

      if (code !== 0 && !stdout) {
        if (scanId) progressStore.delete(scanId);
        return reject(new Error(`Nmap exited with code ${code}. ${stderr || ""}`));
      }

      try {
        const parsed = await parseNmapXML(stdout);
        if (scanId) progressStore.delete(scanId);
        resolve({
          ...parsed,
          raw_xml: stdout,
          stderr: stderr || null,
          command: cmd,
        });
      } catch (parseErr) {
        if (scanId) progressStore.delete(scanId);
        reject(new Error(`Failed to parse nmap output: ${parseErr.message}`));
      }
    });
  });
}

// Progress endpoint
app.get("/api/scan/:id/progress", (req, res) => {
  const progress = progressStore.get(req.params.id);
  if (!progress) {
    // Check if scan completed
    const scan = scanStore.get(req.params.id);
    if (scan && scan.status === "completed") {
      return res.json({ percent: 100, phase: "Completed" });
    }
    return res.json({ percent: 0, phase: "Waiting..." });
  }
  res.json(progress);
});

// Synchronous scan endpoint
app.post("/api/scan", async (req, res) => {
  const { targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand, scanId: providedScanId } = req.body;

  if (scanType !== "raw" && (!targets || (Array.isArray(targets) && targets.length === 0))) {
    return res.status(400).json({ error: "No targets specified" });
  }

  const scanId = providedScanId || randomUUID();
  const startTime = new Date().toISOString();

  try {
    const result = await executeScan({ targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand }, scanId);

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
  const { scanId: providedId, targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand } = req.body;

  if (scanType !== "raw" && (!targets || (Array.isArray(targets) && targets.length === 0))) {
    return res.status(400).json({ error: "No targets specified" });
  }

  const scanId = providedId || randomUUID();
  scanStore.set(scanId, { status: "running", started_at: new Date().toISOString() });

  res.json({ success: true, scanId, status: "running" });

  try {
    const result = await executeScan({ targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand }, scanId);
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
