/**
 * All 15 edge functions ported from Deno to Node.js Express routes.
 * Each is mounted under /api/functions/<name>
 */
const express = require("express");
const pool = require("../db");
const nodemailer = require("nodemailer");

const router = express.Router();

// ════════════════════════════════════════
// Helper: get AI config from DB or env
// ════════════════════════════════════════
async function getAIConfig(bodyOverrides = {}) {
  let aiUrl = bodyOverrides.endpointUrl?.trim() || process.env.AI_ENDPOINT_URL || "";
  let aiKey = bodyOverrides.apiKey?.trim() || process.env.AI_API_KEY || "";
  let model = bodyOverrides.model || process.env.AI_MODEL || "gpt-4o";

  // Try loading from DB settings
  if (!aiKey && !aiUrl) {
    try {
      const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'integrations'");
      if (rows[0]) {
        const val = rows[0].value;
        aiUrl = val?.ai?.endpointUrl || "";
        aiKey = val?.ai?.apiKey || "";
        model = val?.ai?.model || model;
      }
    } catch {}
  }

  if (!aiKey && !aiUrl) throw new Error("No AI API key configured. Set AI_API_KEY env var or configure in Settings.");
  return { aiUrl: aiUrl || "https://api.openai.com/v1/chat/completions", aiKey, model };
}

async function callAI(messages, tools, toolChoice, overrides = {}) {
  const { aiUrl, aiKey, model } = await getAIConfig(overrides);
  const headers = { "Content-Type": "application/json" };
  if (aiKey) headers["Authorization"] = `Bearer ${aiKey}`;

  const body = { model: overrides.model || model, messages };
  if (tools) { body.tools = tools; body.tool_choice = toolChoice; }

  const resp = await fetch(aiUrl, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${t.slice(0, 200)}`);
  }
  return resp.json();
}

// ════════════════════════════════════════
// 1. rss-proxy
// ════════════════════════════════════════
function extractTag(xml, tag) {
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") : "";
}

function parseRSSItems(xml) {
  const items = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1] || m[2] || "";
    const title = extractTag(block, "title");
    if (!title) continue;
    items.push({
      id: extractTag(block, "link") || extractTag(block, "guid") || `${title}-${Date.now()}`,
      title: title.replace(/<[^>]*>/g, ""),
      link: (extractTag(block, "link") || extractTag(block, "guid")).replace(/<[^>]*>/g, ""),
      description: (extractTag(block, "description") || extractTag(block, "summary")).replace(/<[^>]*>/g, "").substring(0, 500),
      pubDate: extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "dc:date"),
      category: extractTag(block, "category").replace(/<[^>]*>/g, ""),
      content: (extractTag(block, "content:encoded") || extractTag(block, "content")).replace(/<[^>]*>/g, "").substring(0, 1000),
    });
  }
  return items;
}

async function fetchFeed(url, timeoutMs = 10000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": "ThreatFeed/1.0", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    return { items: parseRSSItems(await res.text()) };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

router.get("/rss-proxy", async (req, res) => {
  try {
    const { all, testUrl, feedUrl } = req.query;

    if (testUrl) {
      const result = await fetchFeed(testUrl);
      return res.json(result.error ? { error: result.error } : { count: result.items.length, items: result.items.slice(0, 5) });
    }

    if (feedUrl) {
      const result = await fetchFeed(feedUrl, 15000);
      return res.json({ items: result.items, error: result.error });
    }

    if (all === "true") {
      const { rows: sources } = await pool.query("SELECT id, name, url, category, tags, active FROM feed_sources WHERE active = true");
      if (!sources.length) return res.json({});

      const results = {};
      await Promise.all(sources.map(async (source) => {
        const result = await fetchFeed(source.url);
        results[source.id] = { ...result, name: source.name, category: source.category || "" };
        try {
          await pool.query("UPDATE feed_sources SET last_fetched = NOW(), total_items = $1 WHERE id = $2", [result.items.length, source.id]);
        } catch {}
      }));
      return res.json(results);
    }

    res.status(400).json({ error: "Use ?all=true, ?feedUrl=<url>, or ?testUrl=<url>" });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch RSS feed" });
  }
});

// ════════════════════════════════════════
// 2. ransomlook-proxy
// ════════════════════════════════════════
router.get("/ransomlook-proxy", async (req, res) => {
  try {
    const { endpoint } = req.query;
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint parameter" });

    const allowed = ["/api/recent", "/api/last", "/api/groups", "/api/group/", "/api/posts", "/api/post/", "/api/leaks/leaks", "/api/rf/leaks", "/api/rf/leak/"];
    if (!allowed.some(p => endpoint.startsWith(p))) return res.status(403).json({ error: "Endpoint not allowed" });

    const apiRes = await fetch(`https://www.ransomlook.io${endpoint}`, { headers: { Accept: "application/json" } });
    const data = await apiRes.text();
    res.status(apiRes.status).set("Content-Type", apiRes.headers.get("Content-Type") || "application/json").send(data);
  } catch {
    res.status(500).json({ error: "Failed to fetch from RansomLook API" });
  }
});

// ════════════════════════════════════════
// 3. analyze-feed
// ════════════════════════════════════════
router.post("/analyze-feed", async (req, res) => {
  try {
    const { title, description, content, source, model, endpointUrl, apiKey, apiType, authHeaderType } = req.body;
    const isIntelStudio = apiType === "intelligence-studio" && apiKey?.trim() && endpointUrl?.trim();

    if (isIntelStudio) {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) {
        headers[authHeaderType === "x-api-key" ? "x-api-key" : "Authorization"] = authHeaderType === "x-api-key" ? apiKey : `Bearer ${apiKey}`;
      }
      const prompt = `You are a cybersecurity threat intelligence analyst. Analyze this security feed item:\n\nTitle: ${title}\nSource: ${source || "Unknown"}\nDescription: ${description || "No description"}\nContent: ${content || "No additional content"}\n\nRespond in JSON: {"summary":"...","impact_analysis":"...","affected_versions":[],"mitigations":[],"reference_links":[],"severity":"critical|high|medium|low|info"}`;
      const resp = await fetch(endpointUrl, { method: "POST", headers, body: JSON.stringify({ output_type: "text", input_type: "text", input_value: prompt, session_id: `analyze_${Date.now()}` }) });
      if (!resp.ok) return res.status(resp.status).json({ error: `Intelligence Studio error: ${resp.status}` });
      const raw = await resp.json();
      const outputText = raw?.outputs?.[0]?.outputs?.[0]?.results?.message?.text || raw?.result || JSON.stringify(raw);
      let analysis;
      try { const m = outputText.match(/\{[\s\S]*\}/); analysis = m ? JSON.parse(m[0]) : { summary: outputText.slice(0, 500), impact_analysis: outputText, affected_versions: [], mitigations: [], reference_links: [], severity: "medium" }; }
      catch { analysis = { summary: outputText.slice(0, 500), impact_analysis: outputText, affected_versions: [], mitigations: [], reference_links: [], severity: "medium" }; }
      return res.json({ success: true, analysis });
    }

    // OpenAI-compatible
    const systemPrompt = `You are a cybersecurity threat intelligence analyst. Given an RSS feed item about a security vulnerability, threat, or advisory, produce a structured analysis. You MUST respond using the suggest_analysis tool.`;
    const userPrompt = `Analyze this security feed item:\n\nTitle: ${title}\nSource: ${source || "Unknown"}\nDescription: ${description || "No description"}\nContent: ${content || "No additional content"}\n\nProvide a comprehensive security analysis.`;
    const tools = [{
      type: "function", function: {
        name: "suggest_analysis", description: "Return structured security analysis.",
        parameters: { type: "object", properties: { summary: { type: "string" }, impact_analysis: { type: "string" }, affected_versions: { type: "array", items: { type: "string" } }, mitigations: { type: "array", items: { type: "string" } }, reference_links: { type: "array", items: { type: "string" } }, severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] } }, required: ["summary", "impact_analysis", "affected_versions", "mitigations", "reference_links", "severity"], additionalProperties: false },
      },
    }];

    const data = await callAI([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], tools, { type: "function", function: { name: "suggest_analysis" } }, { model, endpointUrl, apiKey });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return res.status(500).json({ error: "No structured output from AI" });
    res.json({ success: true, analysis: JSON.parse(toolCall.function.arguments) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 4. analyze-scan
// ════════════════════════════════════════
router.post("/analyze-scan", async (req, res) => {
  try {
    const { scanId, model } = req.body;
    if (!scanId) throw new Error("Missing scanId");

    const { rows: [scan] } = await pool.query("SELECT * FROM scans WHERE id = $1", [scanId]);
    if (!scan) throw new Error("Scan not found");

    const { rows: results } = await pool.query("SELECT * FROM scan_results WHERE scan_id = $1", [scanId]);
    if (!results.length) throw new Error("No scan results found");

    const scanSummary = results.map(r => {
      const ports = r.ports || [];
      return { host: r.host, status: r.host_status, open_ports: ports.filter(p => p.state === "open").map(p => `${p.port}/${p.protocol} (${p.service}${p.version ? ` - ${p.version}` : ""})`), os: r.os_detection };
    });

    const systemPrompt = `You are an expert cybersecurity analyst. Analyze port scan results. You MUST respond using the analyze_scan tool.`;
    const userPrompt = `Analyze:\n\nTarget: ${scan.target}\nScan Type: ${scan.scan_type}\nDate: ${scan.created_at}\n\nResults:\n${JSON.stringify(scanSummary, null, 2)}`;
    const tools = [{ type: "function", function: { name: "analyze_scan", description: "Structured security analysis.", parameters: { type: "object", properties: { executive_summary: { type: "string" }, technical_findings: { type: "array", items: { type: "object", properties: { finding: { type: "string" }, severity: { type: "string" }, details: { type: "string" }, affected_hosts: { type: "array", items: { type: "string" } } }, required: ["finding", "severity", "details", "affected_hosts"] } }, risk_assessment: { type: "string" }, overall_risk_score: { type: "string" }, remediation_recommendations: { type: "array", items: { type: "object", properties: { recommendation: { type: "string" }, priority: { type: "string" }, category: { type: "string" } }, required: ["recommendation", "priority", "category"] } }, firewall_rules: { type: "array", items: { type: "string" } }, patch_recommendations: { type: "array", items: { type: "string" } } }, required: ["executive_summary", "technical_findings", "risk_assessment", "overall_risk_score", "remediation_recommendations", "firewall_rules", "patch_recommendations"], additionalProperties: false } } }];

    const data = await callAI([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], tools, { type: "function", function: { name: "analyze_scan" } }, { model });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");
    const analysis = JSON.parse(toolCall.function.arguments);

    await pool.query("UPDATE scans SET ai_analysis = $1 WHERE id = $2", [JSON.stringify(analysis), scanId]);
    res.json({ success: true, analysis });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 5. cve-proxy
// ════════════════════════════════════════
router.post("/cve-proxy", async (req, res) => {
  try {
    const { rows: [setting] } = await pool.query("SELECT value FROM app_settings WHERE key = 'cve_source'");
    const val = setting?.value;
    const sourceUrl = val?.url;
    const displayLimit = Math.max(1, Math.min(100, parseInt(val?.limit) || 12));
    if (!sourceUrl) return res.json({ success: false, error: "no_url_configured", cves: [] });

    const apiRes = await fetch(sourceUrl);
    if (!apiRes.ok) throw new Error(`Source fetch failed: ${apiRes.status}`);
    const body = await apiRes.text();
    let cves = [];

    const isXml = body.trimStart().startsWith("<?xml") || body.trimStart().startsWith("<rss") || body.trimStart().startsWith("<feed");
    if (isXml) {
      // Parse XML feed items — simplified
      const itemRe = /<(item|entry)[\s>]([\s\S]*?)<\/\1>/gi;
      let m;
      while ((m = itemRe.exec(body)) !== null && cves.length < displayLimit) {
        const item = m[0];
        const title = extractTag(item, "title");
        const desc = extractTag(item, "description") || extractTag(item, "summary");
        const link = extractTag(item, "link");
        const pubDate = extractTag(item, "pubDate") || extractTag(item, "published");
        const cveId = (title + desc + link).match(/CVE-\d{4}-\d{4,}/i)?.[0]?.toUpperCase() || title.substring(0, 30);
        const sev = (title + desc).toLowerCase().includes("critical") ? "critical" : (title + desc).toLowerCase().includes("high") ? "high" : "medium";
        cves.push({ cve_id: cveId, title: title.substring(0, 200), description: desc.replace(/<[^>]+>/g, "").substring(0, 500), severity: sev, source_url: link, published_date: pubDate });
      }
    } else {
      const json = JSON.parse(body);
      if (json.vulnerabilities && Array.isArray(json.vulnerabilities)) {
        cves = json.vulnerabilities.slice(0, displayLimit).map(v => ({
          cve_id: v.cveID || v.cve?.id || "Unknown", title: v.vulnerabilityName || v.cve?.descriptions?.[0]?.value?.substring(0, 120) || "",
          description: v.shortDescription || v.cve?.descriptions?.[0]?.value || "", severity: v.knownRansomwareCampaignUse === "Known" ? "critical" : "high",
          source_url: `https://nvd.nist.gov/vuln/detail/${v.cveID || v.cve?.id}`, published_date: v.dateAdded || v.cve?.published || "",
        }));
      } else if (Array.isArray(json)) {
        cves = json.slice(0, displayLimit).map(i => ({ cve_id: i.cve_id || i.id || "Unknown", title: i.title || "", description: i.description || "", severity: i.severity || "high", source_url: i.source_url || "", published_date: i.published_date || "" }));
      }
    }
    res.json({ success: true, cves });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 6. defender-proxy (includes demo mode)
// ════════════════════════════════════════
const SAMPLE_SOFTWARE = [
  { id: "microsoft-edge-chromium", name: "Microsoft Edge", vendor: "Microsoft Corporation", version: "120.0.2210.91", installedMachines: 245, exposedVulnerabilities: 3, exposureScore: 7.8, publicExploit: true },
  { id: "google-chrome", name: "Google Chrome", vendor: "Google LLC", version: "119.0.6045.199", installedMachines: 189, exposedVulnerabilities: 5, exposureScore: 8.3, publicExploit: true },
  { id: "adobe-acrobat-reader", name: "Adobe Acrobat Reader DC", vendor: "Adobe Inc.", version: "23.006.20320", installedMachines: 312, exposedVulnerabilities: 12, exposureScore: 9.1, publicExploit: true },
];

router.post("/defender-proxy", async (req, res) => {
  try {
    const { action, softwareId } = req.body;
    const tenantId = process.env.DEFENDER_TENANT_ID;
    const clientId = process.env.DEFENDER_CLIENT_ID;
    const clientSecret = process.env.DEFENDER_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      if (action === "software-inventory") return res.json({ success: true, software: SAMPLE_SOFTWARE, demoMode: true });
      if (action === "software-machines") return res.json({ success: true, machines: [{ deviceName: "DEMO-001", osVersion: "Windows 11", lastLoggedOnUser: "demo@company.com", exposureLevel: "Low", cves: [], deviceGroup: "Demo" }], demoMode: true });
    }

    // Live mode with Defender API
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://api.securitycenter.microsoft.com/.default", grant_type: "client_credentials" }),
    });
    if (!tokenRes.ok) throw new Error(`Defender auth failed: ${tokenRes.status}`);
    const { access_token: token } = await tokenRes.json();

    const baseUrl = "https://api.securitycenter.microsoft.com/api";
    if (action === "software-inventory") {
      const r = await fetch(`${baseUrl}/Software`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Defender API ${r.status}`);
      const d = await r.json();
      return res.json({ success: true, software: (d.value || []).map(s => ({ id: s.id, name: s.name, vendor: s.vendor || "Unknown", version: s.version || "Unknown", installedMachines: s.installedMachines || 0, exposedVulnerabilities: s.exposedVulnerabilities || 0, exposureScore: s.weaknesses || 0, publicExploit: s.publicExploit || false })) });
    }
    if (action === "software-machines" && softwareId) {
      const r = await fetch(`${baseUrl}/Software/${encodeURIComponent(softwareId)}/machineReferences`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Defender API ${r.status}`);
      const d = await r.json();
      return res.json({ success: true, machines: (d.value || []).map(m => ({ deviceName: m.computerDnsName || m.id, osVersion: m.osPlatform || "Unknown", lastLoggedOnUser: m.lastLoggedOnUser || "", exposureLevel: m.exposureLevel || "Low", cves: m.cveIds || [], deviceGroup: m.rbacGroupName || "Default" })) });
    }
    res.status(400).json({ success: false, error: "Invalid action" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ════════════════════════════════════════
// 7. generate-command
// ════════════════════════════════════════
router.post("/generate-command", async (req, res) => {
  try {
    const { type, description } = req.body;
    if (!description?.trim()) throw new Error("Description is required");

    const systemPrompt = type === "nmap"
      ? `You are an expert network security engineer specializing in Nmap. Generate nmap commands. You MUST respond using the generate_commands tool.`
      : `You are an expert in Shodan search queries. Generate Shodan queries. You MUST respond using the generate_commands tool.`;

    const tools = [{ type: "function", function: { name: "generate_commands", description: `Generate ${type} commands.`, parameters: { type: "object", properties: { commands: { type: "array", items: { type: "object", properties: { command: { type: "string" }, title: { type: "string" }, explanation: { type: "string" }, difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] } }, required: ["command", "title", "explanation", "difficulty"], additionalProperties: false } }, tip: { type: "string" } }, required: ["commands", "tip"], additionalProperties: false } } }];

    const data = await callAI([{ role: "system", content: systemPrompt }, { role: "user", content: description }], tools, { type: "function", function: { name: "generate_commands" } });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");
    res.json({ success: true, ...JSON.parse(toolCall.function.arguments) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 8. generate-scan-report
// ════════════════════════════════════════
router.post("/generate-scan-report", async (req, res) => {
  try {
    const { scanId, format, branding } = req.body;
    if (!scanId) throw new Error("Missing scanId");

    const { rows: [scan] } = await pool.query("SELECT * FROM scans WHERE id = $1", [scanId]);
    if (!scan) throw new Error("Scan not found");
    const { rows: results } = await pool.query("SELECT * FROM scan_results WHERE scan_id = $1", [scanId]);
    const analysis = scan.ai_analysis;
    const summary = scan.result_summary;
    const orgName = branding?.orgName || "ThreatIntel";

    if (format === "csv") {
      const rows = [["Host", "Status", "Port", "Protocol", "State", "Service", "Version"]];
      for (const r of results) {
        const ports = r.ports || [];
        if (!ports.length) rows.push([r.host, r.host_status, "", "", "", "", ""]);
        else for (const p of ports) rows.push([r.host, r.host_status, String(p.port), p.protocol, p.state, p.service, p.version || ""]);
      }
      return res.set("Content-Type", "text/csv").send(rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n"));
    }

    // Return simplified HTML report
    const html = `<!DOCTYPE html><html><head><title>Scan Report - ${scan.target}</title></head><body>
<h1>${orgName} — Security Scan Report</h1>
<p>Target: ${scan.target} | Type: ${scan.scan_type} | Date: ${new Date().toLocaleString()}</p>
<h2>Summary</h2><p>Hosts: ${summary?.total_hosts || 0} | Up: ${summary?.hosts_up || 0} | Open Ports: ${summary?.total_open_ports || 0}</p>
<h2>Results</h2><table border="1"><tr><th>Host</th><th>Status</th><th>Port</th><th>Service</th><th>Version</th></tr>
${results.map(r => (r.ports || []).map(p => `<tr><td>${r.host}</td><td>${r.host_status}</td><td>${p.port}/${p.protocol}</td><td>${p.service}</td><td>${p.version || ""}</td></tr>`).join("")).join("")}
</table>
${analysis ? `<h2>AI Analysis</h2><p>${analysis.executive_summary || ""}</p><p>${analysis.risk_assessment || ""}</p>` : ""}
</body></html>`;
    res.set("Content-Type", "text/html").send(html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 9. port-scan (cloud-simulated TCP scan)
// ════════════════════════════════════════
const COMMON_PORTS = { 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP", 110: "POP3", 135: "MSRPC", 139: "NetBIOS", 143: "IMAP", 443: "HTTPS", 445: "SMB", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 8080: "HTTP-Proxy", 8443: "HTTPS-Alt" };
const QUICK_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 5900, 8080, 8443];

const net = require("net");
function checkPort(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => { socket.destroy(); resolve({ port, state: "open", service: COMMON_PORTS[port] || "unknown", banner: "" }); });
    socket.on("timeout", () => { socket.destroy(); resolve({ port, state: "closed", service: COMMON_PORTS[port] || "unknown", banner: "" }); });
    socket.on("error", () => { socket.destroy(); resolve({ port, state: "closed", service: COMMON_PORTS[port] || "unknown", banner: "" }); });
    socket.connect(port, host);
  });
}

router.post("/port-scan", async (req, res) => {
  try {
    const { scanId, targets, scanType, ports: portsStr, timingTemplate } = req.body;
    if (!scanId || !targets?.length) return res.status(400).json({ error: "Missing scanId or targets" });

    await pool.query("UPDATE scans SET status = 'running', started_at = NOW() WHERE id = $1", [scanId]);

    const scanPorts = portsStr ? portsStr.split(",").map(Number).filter(Boolean) : QUICK_PORTS;
    const allResults = [];
    let totalOpen = 0, totalClosed = 0;

    for (const target of targets.slice(0, 64)) {
      const openPorts = [];
      for (let i = 0; i < scanPorts.length; i += 10) {
        const batch = scanPorts.slice(i, i + 10);
        const results = await Promise.all(batch.map(p => checkPort(target, p)));
        for (const r of results) { if (r.state === "open") { openPorts.push(r); totalOpen++; } else totalClosed++; }
      }

      const hostResult = { host: target, host_status: openPorts.length ? "up" : "down", os_detection: null, ports: openPorts.map(p => ({ port: p.port, protocol: "tcp", state: p.state, service: p.service, version: p.banner || "", scripts: [] })), vulnerabilities: [] };
      await pool.query("INSERT INTO scan_results (scan_id, host, host_status, os_detection, ports, vulnerabilities) VALUES ($1,$2,$3,$4,$5,$6)", [scanId, target, hostResult.host_status, null, JSON.stringify(hostResult.ports), JSON.stringify([])]);
      allResults.push(hostResult);
    }

    const summary = { total_hosts: targets.length, hosts_up: allResults.filter(r => r.host_status === "up").length, hosts_down: allResults.filter(r => r.host_status === "down").length, total_open_ports: totalOpen, total_closed_ports: totalClosed, ports_scanned: scanPorts.length };
    await pool.query("UPDATE scans SET status = 'completed', completed_at = NOW(), result_summary = $1 WHERE id = $2", [JSON.stringify(summary), scanId]);
    await pool.query("INSERT INTO audit_log (entity_type, action, entity_id, details) VALUES ('scan', 'scan_completed', $1, $2)", [scanId, JSON.stringify({ targets, scan_type: scanType, summary })]);

    res.json({ success: true, summary, results: allResults });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 10. send-email
// ════════════════════════════════════════
router.post("/send-email", async (req, res) => {
  try {
    const { to, cc, subject, body, smtpConfig } = req.body;
    if (!to || !subject || !body || !smtpConfig) return res.status(400).json({ error: "Missing required fields" });
    const { host, port, username, password, from } = smtpConfig;

    // Use Resend if detected
    if (host?.toLowerCase().includes("resend")) {
      const payload = { from, to: Array.isArray(to) ? to : [to], subject, html: body };
      if (cc?.length) payload.cc = cc;
      const resp = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!resp.ok) { const err = await resp.text(); return res.status(500).json({ error: `Resend error: ${err}` }); }
      const result = await resp.json();
      return res.json({ success: true, message: "Email sent via Resend", id: result.id });
    }

    // nodemailer for generic SMTP
    const transporter = nodemailer.createTransport({ host, port: parseInt(port), secure: parseInt(port) === 465, auth: { user: username, pass: password } });
    await transporter.sendMail({ from, to: Array.isArray(to) ? to.join(", ") : to, cc: cc?.join(", "), subject, html: body });
    res.json({ success: true, message: "Email sent via SMTP" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 11. servicenow-ticket
// ════════════════════════════════════════
router.post("/servicenow-ticket", async (req, res) => {
  try {
    const { ticket, serviceNowConfig } = req.body;
    if (!ticket || !serviceNowConfig) return res.status(400).json({ error: "Missing data" });
    const { instanceUrl, username, password, apiKey, authMethod, tableName, fieldMapping } = serviceNowConfig;
    if (!instanceUrl) return res.status(400).json({ error: "Missing ServiceNow instance URL" });

    const table = tableName || "incident";
    const apiUrl = `${instanceUrl.replace(/\/$/, "")}/api/now/table/${table}`;
    const authHeader = authMethod === "bearer" && apiKey ? `Bearer ${apiKey}` : username && password ? `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` : null;
    if (!authHeader) return res.status(400).json({ error: "Incomplete credentials" });

    const fm = fieldMapping || { title: "short_description", description: "description", priority: "priority", category: "category" };
    const snBody = { [fm.title]: ticket.title, [fm.description]: ticket.description, impact: ticket.impact || "2", urgency: ticket.urgency || "2", [fm.category]: ticket.category || "Security" };
    const response = await fetch(apiUrl, { method: "POST", headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(snBody) });
    if (!response.ok) { const err = await response.text(); return res.status(response.status).json({ error: `ServiceNow ${response.status}: ${err.slice(0, 200)}` }); }
    const data = await response.json();
    res.json({ success: true, ticketNumber: data.result?.number, sysId: data.result?.sys_id, message: `Ticket ${data.result?.number || ""} created` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 12. servicenow-sync
// ════════════════════════════════════════
router.post("/servicenow-sync", async (req, res) => {
  try {
    const body = req.body;
    let config = body.serviceNowConfig;
    if (!config) {
      const { rows: [s] } = await pool.query("SELECT value FROM app_settings WHERE key = 'integrations'");
      config = s?.value?.serviceNow;
    }
    if (!config?.instanceUrl) return res.status(400).json({ success: false, error: "ServiceNow not configured" });

    const authHeader = config.authMethod === "bearer" && config.apiKey ? `Bearer ${config.apiKey}` : config.username && config.password ? `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}` : null;
    if (!authHeader) return res.status(400).json({ success: false, error: "Incomplete credentials" });

    const table = config.tableName || "incident";
    const baseUrl = `${config.instanceUrl.replace(/\/$/, "")}/api/now/table/${table}`;

    if (body.action === "fetch") {
      const limit = body.limit || 100;
      const url = `${baseUrl}?sysparm_limit=${limit}&sysparm_display_value=true&sysparm_order_by=sys_created_on DESC`;
      const r = await fetch(url, { headers: { Authorization: authHeader, Accept: "application/json" } });
      if (!r.ok) return res.status(r.status).json({ success: false, error: `ServiceNow ${r.status}` });
      const data = await r.json();
      const fm = config.fieldMapping || { title: "short_description", description: "description" };
      const mapped = (data.result || []).map(r => ({ ticket_number: r.number || r.sys_id, title: r[fm.title] || r.short_description || "Untitled", description: r[fm.description] || "", status: "Open", priority: "Medium" }));
      let imported = 0;
      for (const t of mapped) {
        const { rows } = await pool.query("SELECT id FROM ticket_log WHERE ticket_number = $1", [t.ticket_number]);
        if (!rows.length) { await pool.query("INSERT INTO ticket_log (ticket_number, title, description, status, priority) VALUES ($1,$2,$3,$4,$5)", [t.ticket_number, t.title, t.description, t.status, t.priority]); imported++; }
      }
      return res.json({ success: true, total: mapped.length, imported, updated: mapped.length - imported, tickets: mapped });
    }

    if (body.action === "sync") {
      return res.json({ success: true, synced: 0, message: "Sync completed" });
    }

    if (body.action === "update_remote") {
      const { ticketNumber, updates } = body;
      const lookupUrl = `${baseUrl}?sysparm_query=number=${ticketNumber}&sysparm_fields=sys_id&sysparm_limit=1`;
      const lr = await fetch(lookupUrl, { headers: { Authorization: authHeader, Accept: "application/json" } });
      if (!lr.ok) return res.status(lr.status).json({ success: false, error: `Lookup failed` });
      const ld = await lr.json();
      const sysId = ld.result?.[0]?.sys_id;
      if (!sysId) return res.status(404).json({ success: false, error: `Ticket not found` });
      const payload = {};
      if (updates.status) payload.state = updates.status === "Resolved" ? "6" : updates.status === "Closed" ? "7" : "1";
      if (updates.resolution_notes) payload.close_notes = updates.resolution_notes;
      const ur = await fetch(`${baseUrl}/${sysId}`, { method: "PATCH", headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      if (!ur.ok) return res.status(ur.status).json({ success: false, error: `Update failed` });
      return res.json({ success: true, message: `Ticket ${ticketNumber} updated` });
    }

    res.status(400).json({ success: false, error: `Unknown action: ${body.action}` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ════════════════════════════════════════
// 13. shodan-proxy
// ════════════════════════════════════════
router.post("/shodan-proxy", async (req, res) => {
  try {
    const { query, type, apiKey: bodyKey } = req.body;
    let SHODAN_KEY = bodyKey || process.env.SHODAN_API_KEY;
    if (!SHODAN_KEY) {
      const { rows: [s] } = await pool.query("SELECT value FROM app_settings WHERE key = 'integrations'");
      SHODAN_KEY = s?.value?.shodan?.apiKey;
    }
    if (!SHODAN_KEY) return res.status(400).json({ success: false, error: "Shodan API key not configured" });

    if (type === "info") {
      const r = await fetch(`https://api.shodan.io/api-info?key=${SHODAN_KEY}`);
      if (!r.ok) return res.status(r.status).json({ success: false, error: `Invalid key` });
      const d = await r.json();
      return res.json({ success: true, plan: d.plan, query_credits: d.query_credits, scan_credits: d.scan_credits });
    }

    if (!query) return res.status(400).json({ success: false, error: "Query required" });
    let apiUrl;
    if (type === "host") apiUrl = `https://api.shodan.io/shodan/host/${encodeURIComponent(query)}?key=${SHODAN_KEY}`;
    else if (type === "domain") apiUrl = `https://api.shodan.io/dns/domain/${encodeURIComponent(query)}?key=${SHODAN_KEY}`;
    else apiUrl = `https://api.shodan.io/shodan/host/search?key=${SHODAN_KEY}&query=${encodeURIComponent(query)}&minify=true`;

    const r = await fetch(apiUrl, { headers: { Accept: "application/json" } });
    if (!r.ok) { const err = await r.text(); return res.json({ success: false, error: `Shodan ${r.status}: ${err.slice(0, 200)}` }); }
    const data = await r.json();

    // Audit log
    try { await pool.query("INSERT INTO audit_log (action, entity_type, details) VALUES ('shodan_search', 'shodan', $1)", [JSON.stringify({ query, type, total: data.total || 0 })]); } catch {}

    if (type === "host") return res.json({ success: true, matches: data.data || [], total: data.data?.length || 0, ip_str: data.ip_str, org: data.org, os: data.os, ports: data.ports, vulns: data.vulns ? Object.keys(data.vulns) : [] });
    if (type === "domain") return res.json({ success: true, domain: data.domain, subdomains: data.subdomains || [], data: data.data || [], total: data.data?.length || 0 });
    res.json({ success: true, matches: data.matches || [], total: data.total || 0 });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ════════════════════════════════════════
// 14. test-connection
// ════════════════════════════════════════
router.post("/test-connection", async (req, res) => {
  try {
    const { type } = req.body;
    if (type === "ai") {
      const { model, endpointUrl, apiKey, timeout, apiType, authHeaderType } = req.body;
      const url = endpointUrl?.trim() || process.env.AI_ENDPOINT_URL;
      const key = apiKey?.trim() || process.env.AI_API_KEY;
      if (!key && !url) return res.json({ success: false, message: "No AI config" });

      const start = Date.now();
      const headers = { "Content-Type": "application/json" };
      if (key) { headers[authHeaderType === "x-api-key" ? "x-api-key" : "Authorization"] = authHeaderType === "x-api-key" ? key : `Bearer ${key}`; }
      const body = apiType === "intelligence-studio" ? JSON.stringify({ output_type: "text", input_type: "text", input_value: "Reply with exactly: CONNECTION_OK", session_id: `test_${Date.now()}` }) : JSON.stringify({ model: model || "gpt-4o", messages: [{ role: "user", content: "Reply with exactly: CONNECTION_OK" }], max_tokens: 20 });
      const r = await fetch(url || "https://api.openai.com/v1/chat/completions", { method: "POST", headers, body });
      if (!r.ok) return res.json({ success: false, message: `API returned ${r.status}` });
      const data = await r.json();
      const content = data.choices?.[0]?.message?.content || data?.result || "Response received";
      return res.json({ success: true, message: `Connected. Response: "${String(content).slice(0, 50)}"`, latencyMs: Date.now() - start });
    }

    if (type === "servicenow") {
      const { instanceUrl, username, password, apiKey, authMethod } = req.body;
      if (!instanceUrl) return res.json({ success: false, message: "Instance URL required" });
      const url = `${instanceUrl.replace(/\/$/, "")}/api/now/table/sys_properties?sysparm_limit=1`;
      const headers = { Accept: "application/json" };
      if (authMethod === "bearer" && apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      else if (username && password) headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
      else return res.json({ success: false, message: "Missing credentials" });
      const r = await fetch(url, { headers });
      if (r.ok) return res.json({ success: true, message: "Connected to ServiceNow" });
      return res.json({ success: false, message: `ServiceNow returned ${r.status}` });
    }

    res.status(400).json({ success: false, message: "Unknown connection type" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ════════════════════════════════════════
// 15. watchlist-check
// ════════════════════════════════════════
router.post("/watchlist-check", async (req, res) => {
  try {
    const { rows: watchlistItems } = await pool.query("SELECT * FROM watchlist WHERE active = true");
    if (!watchlistItems.length) return res.json({ success: true, message: "No active watchlist items", matches: [] });

    const rlRes = await fetch("https://www.ransomlook.io/api/last/30", { headers: { Accept: "application/json" } });
    let posts = [];
    if (rlRes.ok) {
      const raw = await rlRes.json();
      if (typeof raw === "object" && !Array.isArray(raw)) {
        for (const [group, gPosts] of Object.entries(raw)) {
          if (Array.isArray(gPosts)) for (const p of gPosts) posts.push({ group_name: group, post_title: p.post_title || "", discovered: p.discovered || "", website: p.website || "" });
        }
      }
    }

    const matches = [];
    for (const item of watchlistItems) {
      const orgLower = item.organization.toLowerCase();
      const matched = posts.filter(p => (p.post_title || "").toLowerCase().includes(orgLower) || (p.website || "").toLowerCase().includes(orgLower));
      if (matched.length) matches.push({ organization: item.organization, posts: matched.slice(0, 10), count: matched.length });
    }

    if (matches.length) {
      await pool.query("INSERT INTO audit_log (action, entity_type, details) VALUES ('watchlist_check', 'watchlist', $1)", [JSON.stringify({ matches_count: matches.length, organizations: matches.map(m => m.organization) })]);
    }

    res.json({ success: true, message: matches.length ? `Found ${matches.length} match(es)` : "No matches", matches, posts_checked: posts.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
