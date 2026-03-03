import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Common ports and their services
const COMMON_PORTS: Record<number, string> = {
  21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
  80: "HTTP", 110: "POP3", 111: "RPCBind", 135: "MSRPC", 139: "NetBIOS",
  143: "IMAP", 443: "HTTPS", 445: "SMB", 465: "SMTPS", 587: "Submission",
  993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1521: "Oracle", 2049: "NFS",
  3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 5985: "WinRM",
  6379: "Redis", 8080: "HTTP-Proxy", 8443: "HTTPS-Alt", 8888: "HTTP-Alt",
  9090: "Webmin", 9200: "Elasticsearch", 27017: "MongoDB",
};

const QUICK_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 5900, 8080, 8443];
const FULL_PORTS_SAMPLE = [...QUICK_PORTS, 465, 587, 1521, 2049, 5985, 6379, 8888, 9090, 9200, 27017, 111, 1080, 1723, 2082, 2083, 2086, 2087, 3128, 4443, 5000, 5001, 6443, 7001, 7443, 8000, 8008, 8081, 8082, 8181, 8880, 9000, 9443, 10000, 11211, 15672, 27018];

// Validate and sanitize input
function validateTarget(target: string): boolean {
  // IP address
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(target)) return true;
  // CIDR
  if (/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(target)) return true;
  // Domain (basic validation)
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(target)) return true;
  return false;
}

function parsePorts(portsStr: string): number[] {
  if (!portsStr.trim()) return QUICK_PORTS;
  const ports = new Set<number>();
  for (const part of portsStr.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(Number);
      if (start && end && start <= end && end - start < 1000) {
        for (let i = start; i <= end; i++) ports.add(i);
      }
    } else {
      const p = Number(trimmed);
      if (p > 0 && p <= 65535) ports.add(p);
    }
  }
  return [...ports].slice(0, 500); // max 500 ports
}

function expandCIDR(cidr: string): string[] {
  const [base, bits] = cidr.split("/");
  const mask = parseInt(bits);
  if (mask < 24) return [base]; // limit to /24 max
  const parts = base.split(".").map(Number);
  const hostBits = 32 - mask;
  const numHosts = Math.min(Math.pow(2, hostBits), 256);
  const baseAddr = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const network = baseAddr & (0xFFFFFFFF << hostBits);
  const hosts: string[] = [];
  for (let i = 1; i < numHosts - 1 && hosts.length < 64; i++) {
    const addr = network + i;
    hosts.push(`${(addr >> 24) & 255}.${(addr >> 16) & 255}.${(addr >> 8) & 255}.${addr & 255}`);
  }
  return hosts;
}

async function checkPort(host: string, port: number, timeoutMs = 3000): Promise<{ port: number; state: string; service: string; banner: string }> {
  const service = COMMON_PORTS[port] || "unknown";
  try {
    const conn = await Deno.connect({ hostname: host, port, transport: "tcp" });
    let banner = "";
    try {
      // Try to read banner with short timeout
      const buf = new Uint8Array(512);
      const timer = setTimeout(() => { try { conn.close(); } catch {} }, 1500);
      const n = await conn.read(buf);
      clearTimeout(timer);
      if (n && n > 0) {
        banner = new TextDecoder().decode(buf.subarray(0, n)).replace(/[\x00-\x1F\x7F]/g, " ").trim().substring(0, 200);
      }
    } catch { /* no banner */ }
    try { conn.close(); } catch {}
    return { port, state: "open", service, banner };
  } catch {
    return { port, state: "closed", service, banner: "" };
  }
}

async function resolveHost(target: string): Promise<string> {
  // For domains, attempt DNS resolution
  if (/^[a-zA-Z]/.test(target)) {
    try {
      const addrs = await Deno.resolveDns(target, "A");
      if (addrs.length > 0) return addrs[0];
    } catch {}
  }
  return target;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scanId, targets, scanType, ports: portsStr, timingTemplate } = await req.json();

    if (!scanId || !targets || !Array.isArray(targets) || targets.length === 0) {
      return new Response(JSON.stringify({ error: "Missing scanId or targets" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate all targets
    const validTargets: string[] = [];
    for (const t of targets) {
      if (!validateTarget(t)) continue;
      if (t.includes("/")) {
        validTargets.push(...expandCIDR(t));
      } else {
        validTargets.push(t);
      }
    }

    if (validTargets.length === 0) {
      return new Response(JSON.stringify({ error: "No valid targets provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit total targets
    const limitedTargets = validTargets.slice(0, 64);

    // Determine ports based on scan type
    let scanPorts: number[];
    if (portsStr) {
      scanPorts = parsePorts(portsStr);
    } else {
      switch (scanType) {
        case "full": scanPorts = FULL_PORTS_SAMPLE; break;
        case "service": scanPorts = QUICK_PORTS; break;
        case "vuln": scanPorts = QUICK_PORTS; break;
        default: scanPorts = QUICK_PORTS;
      }
    }

    // Determine concurrency from timing template
    const concurrency = { T1: 2, T2: 5, T3: 10, T4: 20, T5: 30 }[timingTemplate || "T3"] || 10;

    // Init supabase to update status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Mark scan as running
    await sb.from("scans").update({ status: "running", started_at: new Date().toISOString() }).eq("id", scanId);

    const allResults: any[] = [];
    let totalOpen = 0;
    let totalClosed = 0;

    for (const target of limitedTargets) {
      const resolvedIp = await resolveHost(target);
      const openPorts: any[] = [];

      // Scan ports in batches
      for (let i = 0; i < scanPorts.length; i += concurrency) {
        const batch = scanPorts.slice(i, i + concurrency);
        const results = await Promise.all(batch.map(p => checkPort(resolvedIp, p, timingTemplate === "T1" ? 5000 : 3000)));
        for (const r of results) {
          if (r.state === "open") {
            openPorts.push(r);
            totalOpen++;
          } else {
            totalClosed++;
          }
        }
      }

      const hostResult = {
        host: target,
        host_status: openPorts.length > 0 ? "up" : "down",
        os_detection: null,
        ports: openPorts.map(p => ({
          port: p.port,
          protocol: "tcp",
          state: p.state,
          service: p.service,
          version: p.banner || "",
          scripts: [],
        })),
        vulnerabilities: [],
      };

      // Insert result
      await sb.from("scan_results").insert({
        scan_id: scanId,
        host: target,
        host_status: hostResult.host_status,
        os_detection: hostResult.os_detection,
        ports: hostResult.ports,
        vulnerabilities: hostResult.vulnerabilities,
      });

      allResults.push(hostResult);
    }

    // Update scan as completed
    const summary = {
      total_hosts: limitedTargets.length,
      hosts_up: allResults.filter(r => r.host_status === "up").length,
      hosts_down: allResults.filter(r => r.host_status === "down").length,
      total_open_ports: totalOpen,
      total_closed_ports: totalClosed,
      ports_scanned: scanPorts.length,
    };

    await sb.from("scans").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result_summary: summary,
    }).eq("id", scanId);

    // Log to audit
    await sb.from("audit_log").insert({
      entity_type: "scan",
      action: "scan_completed",
      entity_id: scanId,
      details: { targets: limitedTargets, scan_type: scanType, summary },
    });

    return new Response(JSON.stringify({ success: true, summary, results: allResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("port-scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Scan failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
