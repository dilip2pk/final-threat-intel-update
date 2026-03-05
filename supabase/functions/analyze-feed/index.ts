import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description, content, source, model, endpointUrl, apiKey } = await req.json();
    
    // Use custom endpoint if provided, otherwise Lovable AI gateway
    const aiUrl = endpointUrl?.trim() || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiKey = apiKey?.trim() || Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey && !endpointUrl) throw new Error("LOVABLE_API_KEY is not configured");

    const selectedModel = model || "google/gemini-3-flash-preview";

    const systemPrompt = `You are a cybersecurity threat intelligence analyst. Given an RSS feed item about a security vulnerability, threat, or advisory, produce a structured analysis. You MUST respond using the suggest_analysis tool. Be thorough but concise. For affected versions, only include if relevant (e.g., software vulnerabilities). For reference links, include the original source and any additional relevant URLs you know about.`;

    const userPrompt = `Analyze this security feed item:

Title: ${title}
Source: ${source || "Unknown"}
Description: ${description || "No description"}
Content: ${content || "No additional content"}

Provide a comprehensive security analysis.`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (aiKey) headers["Authorization"] = `Bearer ${aiKey}`;

    const response = await fetch(aiUrl, {
      method: "POST",
      headers,
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
              name: "suggest_analysis",
              description: "Return structured security analysis of the feed item.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Concise 2-3 sentence summary of the threat/vulnerability" },
                  impact_analysis: { type: "string", description: "Detailed impact analysis including potential consequences, attack vectors, and risk level" },
                  affected_versions: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of affected software/system versions. Empty array if not applicable.",
                  },
                  mitigations: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of recommended mitigation actions and remediation steps",
                  },
                  reference_links: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of relevant reference URLs",
                  },
                  severity: {
                    type: "string",
                    enum: ["critical", "high", "medium", "low", "info"],
                    description: "Assessed severity level",
                  },
                },
                required: ["summary", "impact_analysis", "affected_versions", "mitigations", "reference_links", "severity"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      // Fallback: try to use the content directly
      const content_text = data.choices?.[0]?.message?.content;
      return new Response(JSON.stringify({ error: "No structured output from AI", raw: content_text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-feed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
