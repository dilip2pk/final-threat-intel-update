import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description, content, source, sourceUrl, model, endpointUrl, apiKey, apiType, authHeaderType } = await req.json();

    // Only use Intelligence Studio if both endpoint and key are provided
    const hasIntelStudio = apiType === "intelligence-studio" && apiKey?.trim() && endpointUrl?.trim();
    const isIntelStudio = hasIntelStudio;

    // Fall back to Lovable AI gateway when no valid custom config
    const aiUrl = (hasIntelStudio ? endpointUrl?.trim() : null) || (endpointUrl?.trim() && apiKey?.trim() ? endpointUrl.trim() : "https://ai.gateway.lovable.dev/v1/chat/completions");
    const aiKey = (hasIntelStudio ? apiKey?.trim() : null) || apiKey?.trim() || Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey && !endpointUrl?.trim()) throw new Error("LOVABLE_API_KEY is not configured");

    const selectedModel = model || "google/gemini-3-flash-preview";

    const analysisPrompt = `You are a cybersecurity threat intelligence analyst. Analyze this security feed item and provide a structured analysis.

Title: ${title}
Source: ${source || "Unknown"}
Description: ${description || "No description"}
Content: ${content || "No additional content"}

Respond in this exact JSON format:
{
  "summary": "2-3 sentence summary",
  "impact_analysis": "detailed impact analysis",
  "affected_versions": ["version1", "version2"],
  "mitigations": ["mitigation1", "mitigation2"],
  "reference_links": ["url1"],
  "severity": "critical|high|medium|low|info"
}`;

    let analysisData: any;

    if (isIntelStudio) {
      // Intelligence Studio uses a different payload format
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (aiKey) {
        if (authHeaderType === "x-api-key") {
          headers["x-api-key"] = aiKey;
        } else {
          headers["Authorization"] = `Bearer ${aiKey}`;
        }
      }

      const response = await fetch(aiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          output_type: "text",
          input_type: "text",
          input_value: analysisPrompt,
          session_id: `analyze_${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Intelligence Studio error:", response.status, t);
        return new Response(JSON.stringify({ error: `Intelligence Studio API returned ${response.status}: ${t.slice(0, 200)}` }), {
          status: response.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawData = await response.json();
      // Intelligence Studio returns text — extract the output
      const outputText = rawData?.outputs?.[0]?.outputs?.[0]?.results?.message?.text
        || rawData?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message
        || rawData?.result || rawData?.output || rawData?.text
        || (typeof rawData === "string" ? rawData : JSON.stringify(rawData));

      // Try to parse JSON from the response
      try {
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: create structured response from text
          analysisData = {
            summary: outputText.slice(0, 500),
            impact_analysis: outputText,
            affected_versions: [],
            mitigations: [],
            reference_links: [],
            severity: "medium",
          };
        }
      } catch {
        analysisData = {
          summary: outputText.slice(0, 500),
          impact_analysis: outputText,
          affected_versions: [],
          mitigations: [],
          reference_links: [],
          severity: "medium",
        };
      }
    } else {
      // OpenAI-compatible flow (built-in or custom)
      const systemPrompt = `You are a cybersecurity threat intelligence analyst. Given an RSS feed item about a security vulnerability, threat, or advisory, produce a structured analysis. You MUST respond using the suggest_analysis tool. Be thorough but concise. For affected versions, only include if relevant (e.g., software vulnerabilities).

IMPORTANT for reference_links:
- ALWAYS include the original source link if provided in the feed item.
- Only include URLs that are real, well-known, and directly relevant (e.g., official CVE pages like cve.mitre.org, NVD entries, vendor advisories).
- Do NOT fabricate or guess URLs. If you are unsure a URL exists, do not include it.
- Prefer specific article/advisory URLs over generic homepages.`;

      const userPrompt = `Analyze this security feed item:

Title: ${title}
Source: ${source || "Unknown"}
${sourceUrl ? `Source URL: ${sourceUrl}` : ""}
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
        const content_text = data.choices?.[0]?.message?.content;
        return new Response(JSON.stringify({ error: "No structured output from AI", raw: content_text }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      analysisData = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify({ success: true, analysis: analysisData }), {
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
