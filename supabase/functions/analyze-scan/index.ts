import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scanId, model } = await req.json();
    if (!scanId) throw new Error("Missing scanId");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch scan and results
    const { data: scan } = await sb.from("scans").select("*").eq("id", scanId).single();
    if (!scan) throw new Error("Scan not found");

    const { data: results } = await sb.from("scan_results").select("*").eq("scan_id", scanId);
    if (!results || results.length === 0) throw new Error("No scan results found");

    // Build scan summary for AI
    const scanSummary = results.map(r => {
      const ports = (r.ports as any[]) || [];
      const openPorts = ports.filter((p: any) => p.state === "open");
      return {
        host: r.host,
        status: r.host_status,
        open_ports: openPorts.map((p: any) => `${p.port}/${p.protocol} (${p.service}${p.version ? ` - ${p.version}` : ""})`),
        os: r.os_detection,
      };
    });

    const selectedModel = model || "google/gemini-3-flash-preview";

    const systemPrompt = `You are an expert cybersecurity analyst specializing in network vulnerability assessment. Analyze port scan results and provide comprehensive security recommendations. You MUST respond using the analyze_scan tool.`;

    const userPrompt = `Analyze these port scan results:

Target: ${scan.target}
Scan Type: ${scan.scan_type}
Scan Date: ${scan.created_at}

Results:
${JSON.stringify(scanSummary, null, 2)}

Provide a thorough security analysis including risk assessment, remediation recommendations, and priority actions.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_scan",
              description: "Return structured security analysis of port scan results.",
              parameters: {
                type: "object",
                properties: {
                  executive_summary: { type: "string", description: "High-level 3-4 sentence summary for management" },
                  technical_findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        finding: { type: "string" },
                        severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
                        details: { type: "string" },
                        affected_hosts: { type: "array", items: { type: "string" } },
                      },
                      required: ["finding", "severity", "details", "affected_hosts"],
                      additionalProperties: false,
                    },
                  },
                  risk_assessment: { type: "string", description: "Overall risk assessment with risk score explanation" },
                  overall_risk_score: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  remediation_recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        recommendation: { type: "string" },
                        priority: { type: "string", enum: ["immediate", "short-term", "long-term"] },
                        category: { type: "string", enum: ["firewall", "patching", "configuration", "monitoring", "access-control"] },
                      },
                      required: ["recommendation", "priority", "category"],
                      additionalProperties: false,
                    },
                  },
                  firewall_rules: {
                    type: "array",
                    items: { type: "string" },
                    description: "Suggested firewall rules or hardening steps",
                  },
                  patch_recommendations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Software/service patches to apply",
                  },
                },
                required: ["executive_summary", "technical_findings", "risk_assessment", "overall_risk_score", "remediation_recommendations", "firewall_rules", "patch_recommendations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_scan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save analysis to scan
    await sb.from("scans").update({ ai_analysis: analysis }).eq("id", scanId);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Analysis failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
