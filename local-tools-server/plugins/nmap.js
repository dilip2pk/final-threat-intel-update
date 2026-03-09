/**
 * Nmap Plugin for Local Tools Server
 * 
 * Provides network scanning via the Nmap binary.
 */

const { spawn, exec } = require("child_process");
const { parseString } = require("xml2js");

const NMAP_PATH = process.env.NMAP_PATH || "nmap";

// In-memory stores
const scanStore = new Map();
const progressStore = new Map();

/** Plugin metadata — used by the server registry */
const metadata = {
  id: "nmap",
  name: "Nmap Network Scanner",
  description: "Execute real Nmap scans with OS detection, version scanning, and NSE scripts",
  version: "1.0.0",
  icon: "🔍",
  category: "network",
  requires: ["nmap"],
  envVars: {
    NMAP_PATH: { description: "Path to the nmap binary", default: "nmap" },
  },
};

/** Health check — verify the tool binary is available */
async function healthCheck() {
  return new Promise((resolve) => {
    exec(`${NMAP_PATH} --version`, (err, stdout) => {
      if (err) {
        resolve({ status: "error", available: false, message: "Nmap not found. Install nmap and ensure it's in PATH." });
      } else {
        const version = stdout.split("\n")[0] || stdout.trim();
        resolve({ status: "ok", available: true, version });
      }
    });
  });
}

/** Build nmap command from params */
function buildNmapCommand(params) {
  const { targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand } = params;

  if (scanType === "raw" && rawCommand) {
    let cmd = rawCommand.trim();
    cmd = cmd.replace(/-oX\s+\S+/g, "").trim();
    if (!cmd.startsWith("nmap") && !cmd.startsWith(NMAP_PATH)) {
      cmd = `${NMAP_PATH} ${cmd}`;
    } else if (cmd.startsWith("nmap") && NMAP_PATH !== "nmap") {
      cmd = cmd.replace(/^nmap/, NMAP_PATH);
    }
    cmd += " -oX - --stats-every 3s";
    return cmd;
  }

  const parts = [NMAP_PATH];
  if (timingTemplate) parts.push(`-${timingTemplate}`);

  switch (scanType) {
    case "quick": parts.push("-F"); break;
    case "full": parts.push("-p-"); break;
    case "service": parts.push("-sV"); break;
    case "vuln": parts.push("-sV"); if (enableScripts !== false) parts.push("--script=vuln"); break;
    case "custom": break;
    default: parts.push("-F");
  }

  if (ports && scanType !== "full") parts.push(`-p ${ports}`);
  if (enableScripts && scanType !== "vuln") parts.push("--script=default,vuln");
  parts.push("-O --osscan-guess");
  if (customOptions) parts.push(customOptions);
  parts.push("-oX - --stats-every 3s");

  const targetList = Array.isArray(targets) ? targets : [targets];
  parts.push(...targetList.map(t => t.trim()).filter(Boolean));
  return parts.join(" ");
}

/** Parse nmap XML output */
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
          osDetection = matches.slice(0, 3).map(m => ({ name: m.name, accuracy: m.accuracy }));
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
              vulnerabilities.push({ port: parseInt(p.portid), script: s.id, output: s.output, severity: s.output?.includes("VULNERABLE") ? "high" : "medium" });
            }
          }
        }

        return { host: ip, host_status: hostStatus === "up" ? "up" : "down", mac: mac?.addr || null, os_detection: osDetection, ports: ports.filter(p => p.state === "open"), all_ports: ports, vulnerabilities };
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

function parseProgress(stderrLine) {
  const percentMatch = stderrLine.match(/About\s+([\d.]+)%\s+done/);
  if (percentMatch) return { percent: Math.round(parseFloat(percentMatch[1])), phase: stderrLine.trim() };
  const completedMatch = stderrLine.match(/Completed\s+(.+?)\s+at/);
  if (completedMatch) return { percent: 100, phase: `Completed ${completedMatch[1]}` };
  const statsMatch = stderrLine.match(/Stats:\s+(.+)/);
  if (statsMatch) return { phase: statsMatch[1].trim() };
  return null;
}

async function executeScan(params, scanId) {
  const cmd = buildNmapCommand(params);
  console.log(`[nmap] Executing: ${cmd}`);
  if (scanId) progressStore.set(scanId, { percent: 0, phase: "Initializing scan...", startedAt: Date.now() });

  return new Promise((resolve, reject) => {
    const timeout = parseInt(params.timeout) || 600;
    let stdout = "";
    let stderr = "";
    const args = cmd.split(/\s+/).slice(1);
    const nmapBin = cmd.split(/\s+/)[0];
    const child = spawn(nmapBin, args, { timeout: timeout * 1000 });

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (scanId) {
        for (const line of chunk.split("\n")) {
          if (line.trim()) {
            const progress = parseProgress(line);
            if (progress) {
              const current = progressStore.get(scanId) || {};
              progressStore.set(scanId, { ...current, ...progress, percent: progress.percent ?? current.percent ?? 0, lastUpdate: Date.now() });
            }
          }
        }
      }
    });

    child.on("error", (err) => { if (scanId) progressStore.delete(scanId); reject(new Error(`Nmap execution failed: ${err.message}`)); });
    child.on("close", async (code) => {
      if (scanId) progressStore.set(scanId, { percent: 100, phase: "Parsing results...", lastUpdate: Date.now() });
      if (code !== 0 && !stdout) { if (scanId) progressStore.delete(scanId); return reject(new Error(`Nmap exited with code ${code}. ${stderr || ""}`)); }
      try {
        const parsed = await parseNmapXML(stdout);
        if (scanId) progressStore.delete(scanId);
        resolve({ ...parsed, raw_xml: stdout, stderr: stderr || null, command: cmd });
      } catch (parseErr) { if (scanId) progressStore.delete(scanId); reject(new Error(`Failed to parse nmap output: ${parseErr.message}`)); }
    });
  });
}

/** Register routes on the Express app */
function registerRoutes(router) {
  // Synchronous scan
  router.post("/execute", async (req, res) => {
    const { targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand, scanId: providedScanId } = req.body;
    if (scanType !== "raw" && (!targets || (Array.isArray(targets) && targets.length === 0))) {
      return res.status(400).json({ error: "No targets specified" });
    }
    const scanId = providedScanId || require("crypto").randomUUID();
    const startTime = new Date().toISOString();
    try {
      const result = await executeScan({ targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand }, scanId);
      res.json({
        success: true, scanId, started_at: startTime, completed_at: new Date().toISOString(),
        summary: result.summary,
        results: result.hosts.map(h => ({ host: h.host, host_status: h.host_status, os_detection: h.os_detection, ports: h.ports, vulnerabilities: h.vulnerabilities })),
        command: result.command,
      });
    } catch (err) { res.status(500).json({ error: err.message, scanId }); }
  });

  // Async scan
  router.post("/execute/async", async (req, res) => {
    const { scanId: providedId, targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand } = req.body;
    if (scanType !== "raw" && (!targets || (Array.isArray(targets) && targets.length === 0))) {
      return res.status(400).json({ error: "No targets specified" });
    }
    const scanId = providedId || require("crypto").randomUUID();
    scanStore.set(scanId, { status: "running", started_at: new Date().toISOString() });
    res.json({ success: true, scanId, status: "running" });

    try {
      const result = await executeScan({ targets, scanType, ports, timingTemplate, enableScripts, customOptions, rawCommand }, scanId);
      scanStore.set(scanId, {
        status: "completed", started_at: scanStore.get(scanId)?.started_at, completed_at: new Date().toISOString(),
        summary: result.summary,
        results: result.hosts.map(h => ({ host: h.host, host_status: h.host_status, os_detection: h.os_detection, ports: h.ports, vulnerabilities: h.vulnerabilities })),
        command: result.command,
      });
    } catch (err) { scanStore.set(scanId, { status: "failed", error: err.message, started_at: scanStore.get(scanId)?.started_at, completed_at: new Date().toISOString() }); }
  });

  // Progress
  router.get("/progress/:id", (req, res) => {
    const progress = progressStore.get(req.params.id);
    if (!progress) {
      const scan = scanStore.get(req.params.id);
      if (scan && scan.status === "completed") return res.json({ percent: 100, phase: "Completed" });
      return res.json({ percent: 0, phase: "Waiting..." });
    }
    res.json(progress);
  });

  // Get scan result
  router.get("/result/:id", (req, res) => {
    const scan = scanStore.get(req.params.id);
    if (!scan) return res.status(404).json({ error: "Scan not found" });
    res.json(scan);
  });

  // List recent scans
  router.get("/results", (req, res) => {
    const scans = [];
    for (const [id, data] of scanStore.entries()) scans.push({ id, ...data });
    res.json(scans.slice(-50).reverse());
  });
}

// --- Backward compatibility: map old /api/scan routes to new plugin routes ---
function registerLegacyRoutes(app) {
  app.post("/api/scan", async (req, res) => {
    req.url = "/api/tools/nmap/execute";
    app.handle(req, res);
  });
  app.post("/api/scan/async", async (req, res) => {
    req.url = "/api/tools/nmap/execute/async";
    app.handle(req, res);
  });
  app.get("/api/scan/:id/progress", (req, res) => {
    const progress = progressStore.get(req.params.id);
    if (!progress) {
      const scan = scanStore.get(req.params.id);
      if (scan && scan.status === "completed") return res.json({ percent: 100, phase: "Completed" });
      return res.json({ percent: 0, phase: "Waiting..." });
    }
    res.json(progress);
  });
  app.get("/api/scan/:id", (req, res) => {
    const scan = scanStore.get(req.params.id);
    if (!scan) return res.status(404).json({ error: "Scan not found" });
    res.json(scan);
  });
  app.get("/api/scans", (req, res) => {
    const scans = [];
    for (const [id, data] of scanStore.entries()) scans.push({ id, ...data });
    res.json(scans.slice(-50).reverse());
  });
}

module.exports = { metadata, healthCheck, registerRoutes, registerLegacyRoutes };
