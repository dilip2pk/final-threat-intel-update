import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const period = body?.period || "weekly"; // "weekly" or "monthly"

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const daysBack = period === "monthly" ? 30 : 7;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    // Gather data from all sources in parallel
    const [
      { data: scans },
      { data: alertRules },
      { data: topCves },
      { data: auditLogs },
      { data: watchlist },
      { data: tickets },
      { data: genSettings },
    ] = await Promise.all([
      supabase.from("scans").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      supabase.from("alert_rules").select("*").eq("active", true),
      supabase.from("top_cves").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("audit_log").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
      supabase.from("watchlist").select("*").eq("active", true),
      supabase.from("ticket_log").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      supabase.from("app_settings").select("value").eq("key", "general").single(),
    ]);

    const appName = (genSettings?.value as any)?.appName || "ThreatIntel";

    // Build context for AI
    const scanSummary = (scans || []).map(s => ({
      target: s.target,
      type: s.scan_type,
      status: s.status,
      risk: (s.ai_analysis as any)?.overall_risk_score || "unknown",
      date: s.created_at,
    }));

    const cveSummary = (topCves || []).map(c => ({
      id: c.cve_id,
      title: c.title,
      severity: c.severity,
    }));

    const ticketSummary = {
      total: (tickets || []).length,
      open: (tickets || []).filter(t => t.status === "Open").length,
      critical: (tickets || []).filter(t => t.priority === "Critical" || t.priority === "High").length,
    };

    const watchlistOrgs = (watchlist || []).map(w => w.organization);

    // Fetch RansomLook recent data
    let ransomMatches: any[] = [];
    try {
      const rlResp = await fetch("https://www.ransomlook.io/api/last/7", {
        headers: { Accept: "application/json" },
      });
      if (rlResp.ok) {
        const rlData = await rlResp.json();
        if (typeof rlData === "object" && !Array.isArray(rlData)) {
          for (const org of watchlistOrgs) {
            const orgLower = org.toLowerCase();
            for (const [group, posts] of Object.entries(rlData)) {
              if (Array.isArray(posts)) {
                for (const p of posts) {
                  if ((p.post_title || "").toLowerCase().includes(orgLower) ||
                      (p.website || "").toLowerCase().includes(orgLower)) {
                    ransomMatches.push({ organization: org, group, post_title: p.post_title });
                  }
                }
              }
            }
          }
        }
      }
    } catch { /* ignore */ }

    // Compute stats
    const scansByRisk: Record<string, number> = {};
    for (const s of scanSummary) {
      scansByRisk[s.risk] = (scansByRisk[s.risk] || 0) + 1;
    }

    const cveBySeverity: Record<string, number> = {};
    for (const c of cveSummary) {
      cveBySeverity[c.severity] = (cveBySeverity[c.severity] || 0) + 1;
    }

    const reportData = {
      period,
      periodLabel: period === "monthly" ? "Monthly" : "Weekly",
      dateRange: { from: since, to: new Date().toISOString() },
      appName,
      stats: {
        totalScans: scanSummary.length,
        scansByRisk,
        totalCves: cveSummary.length,
        cveBySeverity,
        tickets: ticketSummary,
        activeAlertRules: (alertRules || []).length,
        watchlistOrgs: watchlistOrgs.length,
        ransomMatches: ransomMatches.length,
      },
      scans: scanSummary.slice(0, 10),
      cves: cveSummary.slice(0, 10),
      ransomMatches: ransomMatches.slice(0, 10),
      tickets: (tickets || []).slice(0, 10).map(t => ({
        number: t.ticket_number,
        title: t.title,
        priority: t.priority,
        status: t.status,
      })),
    };

    // Generate AI executive summary
    let aiSummary = "";
    let aiRecommendations: string[] = [];
    let riskScore = "medium";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const aiPrompt = `You are a cybersecurity executive advisor. Generate a concise executive risk briefing based on the following threat intelligence data from the past ${daysBack} days.

DATA:
- ${reportData.stats.totalScans} network scans performed. Risk distribution: ${JSON.stringify(scansByRisk)}
- ${reportData.stats.totalCves} tracked CVEs. Severity: ${JSON.stringify(cveBySeverity)}
- ${ticketSummary.total} security tickets (${ticketSummary.open} open, ${ticketSummary.critical} high/critical priority)
- ${reportData.stats.activeAlertRules} active threat detection rules
- ${watchlistOrgs.length} organizations on RansomLook watchlist, ${ransomMatches.length} matches found
- Top CVEs: ${cveSummary.slice(0, 5).map(c => `${c.id} (${c.severity}): ${c.title}`).join("; ")}
- Recent scans: ${scanSummary.slice(0, 5).map(s => `${s.target} - ${s.risk} risk`).join("; ")}

Return a JSON object with these fields (use tool calling):`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a cybersecurity executive advisor." },
              { role: "user", content: aiPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "executive_briefing",
                description: "Return an executive risk briefing",
                parameters: {
                  type: "object",
                  properties: {
                    executive_summary: { type: "string", description: "3-5 sentence executive summary of the security posture" },
                    overall_risk_level: { type: "string", enum: ["critical", "high", "medium", "low"] },
                    key_findings: { type: "array", items: { type: "string" }, description: "5-7 key findings" },
                    recommendations: { type: "array", items: { type: "string" }, description: "3-5 actionable recommendations" },
                    trend_assessment: { type: "string", description: "Brief assessment of whether risk is increasing, stable, or decreasing" },
                  },
                  required: ["executive_summary", "overall_risk_level", "key_findings", "recommendations", "trend_assessment"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "executive_briefing" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            aiSummary = parsed.executive_summary || "";
            aiRecommendations = parsed.recommendations || [];
            riskScore = parsed.overall_risk_level || "medium";
            (reportData as any).ai = parsed;
          }
        }
      } catch (e) {
        console.error("AI summary error:", e);
      }
    }

    (reportData as any).ai = (reportData as any).ai || {
      executive_summary: aiSummary || "AI summary unavailable. Please review the data manually.",
      overall_risk_level: riskScore,
      key_findings: [],
      recommendations: aiRecommendations,
      trend_assessment: "Unable to assess trend.",
    };

    return new Response(JSON.stringify({ success: true, report: reportData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("executive-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
