import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function severityColor(s: string): string {
  switch (s) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#14b8a6";
    default: return "#6b7280";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scanId, format, branding } = await req.json();
    if (!scanId) throw new Error("Missing scanId");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: scan } = await sb.from("scans").select("*").eq("id", scanId).single();
    if (!scan) throw new Error("Scan not found");

    const { data: results } = await sb.from("scan_results").select("*").eq("scan_id", scanId);
    const analysis = scan.ai_analysis as any;
    const summary = scan.result_summary as any;
    const logoUrl = branding?.logoUrl || "";
    const orgName = branding?.orgName || "ThreatIntel";
    const analystName = branding?.analystName || "";
    const disclaimer = branding?.disclaimer || "This report is confidential and intended for authorized personnel only.";
    const primaryColor = branding?.primaryColor || "#14b8a6";

    if (format === "csv") {
      const rows = [["Host", "Status", "Port", "Protocol", "State", "Service", "Version"]];
      for (const r of (results || [])) {
        const ports = (r.ports as any[]) || [];
        if (ports.length === 0) {
          rows.push([r.host, r.host_status, "", "", "", "", ""]);
        } else {
          for (const p of ports) {
            rows.push([r.host, r.host_status, String(p.port), p.protocol, p.state, p.service, p.version || ""]);
          }
        }
      }
      const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
      return new Response(csv, {
        headers: { ...corsHeaders, "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="scan-report-${scanId.slice(0, 8)}.csv"` },
      });
    }

    // HTML report
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Scan Report - ${escapeHtml(scan.target)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; font-size: 14px; line-height: 1.6; }
  .header { background: ${primaryColor}; color: white; padding: 40px; display: flex; align-items: center; gap: 24px; }
  .header img { height: 60px; }
  .header h1 { font-size: 28px; font-weight: 700; }
  .header p { opacity: 0.9; font-size: 14px; }
  .meta-bar { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 16px 40px; display: flex; gap: 32px; flex-wrap: wrap; font-size: 13px; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
  .content { padding: 40px; max-width: 1000px; }
  h2 { font-size: 20px; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid ${primaryColor}; color: ${primaryColor}; }
  h3 { font-size: 16px; margin: 20px 0 8px; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin: 16px 0; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .value { font-size: 28px; font-weight: 700; color: ${primaryColor}; }
  .summary-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f1f5f9; font-weight: 600; text-align: left; padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 10px 12px; border: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #fafbfc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: white; }
  .finding { background: #f8fafc; border-left: 4px solid; border-radius: 4px; padding: 16px; margin: 12px 0; }
  .rec { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
  .rec-priority { font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; font-size: 12px; color: #64748b; margin-top: 40px; }
  @media print { .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" />` : ""}
  <div>
    <h1>${escapeHtml(orgName)} — Security Scan Report</h1>
    <p>Target: ${escapeHtml(scan.target)} | Generated: ${new Date().toLocaleString()}</p>
  </div>
</div>
<div class="meta-bar">
  <div class="meta-item"><span class="meta-label">Scan Type</span><span>${escapeHtml(scan.scan_type)}</span></div>
  <div class="meta-item"><span class="meta-label">Started</span><span>${scan.started_at ? new Date(scan.started_at).toLocaleString() : "N/A"}</span></div>
  <div class="meta-item"><span class="meta-label">Completed</span><span>${scan.completed_at ? new Date(scan.completed_at).toLocaleString() : "N/A"}</span></div>
  ${analystName ? `<div class="meta-item"><span class="meta-label">Analyst</span><span>${escapeHtml(analystName)}</span></div>` : ""}
  ${analysis?.overall_risk_score ? `<div class="meta-item"><span class="meta-label">Risk Level</span><span class="badge" style="background:${severityColor(analysis.overall_risk_score)}">${analysis.overall_risk_score.toUpperCase()}</span></div>` : ""}
</div>
<div class="content">
  <h2>Scan Summary</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="value">${summary?.total_hosts || 0}</div><div class="label">Total Hosts</div></div>
    <div class="summary-card"><div class="value">${summary?.hosts_up || 0}</div><div class="label">Hosts Up</div></div>
    <div class="summary-card"><div class="value">${summary?.total_open_ports || 0}</div><div class="label">Open Ports</div></div>
    <div class="summary-card"><div class="value">${summary?.ports_scanned || 0}</div><div class="label">Ports Scanned</div></div>
  </div>

  <h2>Host & Port Details</h2>
  <table>
    <thead><tr><th>Host</th><th>Status</th><th>Port</th><th>Service</th><th>Version/Banner</th></tr></thead>
    <tbody>
    ${(results || []).map(r => {
      const ports = (r.ports as any[]) || [];
      if (ports.length === 0) return `<tr><td>${escapeHtml(r.host)}</td><td>${r.host_status}</td><td colspan="3">No open ports</td></tr>`;
      return ports.map((p: any, i: number) =>
        `<tr><td>${i === 0 ? escapeHtml(r.host) : ""}</td><td>${i === 0 ? r.host_status : ""}</td><td>${p.port}/${p.protocol}</td><td>${escapeHtml(p.service)}</td><td>${escapeHtml(p.version || "")}</td></tr>`
      ).join("");
    }).join("")}
    </tbody>
  </table>

  ${analysis ? `
  <h2>AI Security Analysis</h2>
  <h3>Executive Summary</h3>
  <p>${escapeHtml(analysis.executive_summary || "")}</p>

  <h3>Risk Assessment</h3>
  <p>${escapeHtml(analysis.risk_assessment || "")}</p>

  <h3>Technical Findings</h3>
  ${(analysis.technical_findings || []).map((f: any) => `
    <div class="finding" style="border-color: ${severityColor(f.severity)}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="badge" style="background:${severityColor(f.severity)}">${f.severity.toUpperCase()}</span>
        <strong>${escapeHtml(f.finding)}</strong>
      </div>
      <p>${escapeHtml(f.details)}</p>
      ${f.affected_hosts?.length ? `<p style="margin-top:8px;font-size:12px;color:#64748b">Affected: ${f.affected_hosts.join(", ")}</p>` : ""}
    </div>
  `).join("")}

  <h3>Remediation Recommendations</h3>
  ${(analysis.remediation_recommendations || []).map((r: any) => `
    <div class="rec">
      <span class="rec-priority" style="color:${r.priority === "immediate" ? "#ef4444" : r.priority === "short-term" ? "#f97316" : "#14b8a6"}">${r.priority}</span>
      <span class="badge" style="background:#6366f1;margin-left:8px">${r.category}</span>
      <p style="margin-top:8px">${escapeHtml(r.recommendation)}</p>
    </div>
  `).join("")}

  ${analysis.firewall_rules?.length ? `
  <h3>Firewall Hardening</h3>
  <ul>${analysis.firewall_rules.map((r: string) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
  ` : ""}

  ${analysis.patch_recommendations?.length ? `
  <h3>Patch Recommendations</h3>
  <ul>${analysis.patch_recommendations.map((r: string) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
  ` : ""}
  ` : ""}
</div>
<div class="footer">
  <p>${escapeHtml(disclaimer)}</p>
  <p style="margin-top:8px">${escapeHtml(orgName)} &copy; ${new Date().getFullYear()}</p>
</div>
</body></html>`;

    const contentType = format === "pdf" ? "text/html" : "text/html";
    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": contentType },
    });
  } catch (e) {
    console.error("generate-scan-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Report generation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
