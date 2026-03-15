import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default prompts (fallback if DB has none)
const DEFAULT_SYSTEM_PROMPT = `You are a cybersecurity threat intelligence analyst. Given an RSS feed item about a security vulnerability, threat, or advisory, produce a structured analysis. Be thorough but concise. For affected versions, only include if relevant (e.g., software vulnerabilities).

IMPORTANT for reference_links:
- ALWAYS include the original source link if provided in the feed item.
- Only include URLs that are real, well-known, and directly relevant (e.g., official CVE pages like cve.mitre.org, NVD entries, vendor advisories).
- Do NOT fabricate or guess URLs. If you are unsure a URL exists, do not include it.
- Prefer specific article/advisory URLs over generic homepages.`;

const DEFAULT_USER_TEMPLATE = `Analyze this security feed item:

Title: {{title}}
Source: {{source}}
{{#sourceUrl}}Source URL: {{sourceUrl}}{{/sourceUrl}}
Description: {{description}}
Content: {{content}}

Provide a comprehensive security analysis.`;

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
    // Handle conditional sections {{#key}}...{{/key}}
    if (value) {
      result = result.replace(new RegExp(`\\{\\{#${key}\\}\\}(.+?)\\{\\{/${key}\\}\\}`, "gs"), "$1");
    } else {
      result = result.replace(new RegExp(`\\{\\{#${key}\\}\\}(.+?)\\{\\{/${key}\\}\\}`, "gs"), "");
    }
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description, content, source, sourceUrl, model, endpointUrl, apiKey, apiType, authHeaderType, testPrompt } = await req.json();

    // Try to load prompt from DB
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    let userTemplate = DEFAULT_USER_TEMPLATE;

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      // If testPrompt is provided, use that instead of DB
      if (testPrompt) {
        systemPrompt = testPrompt.system || DEFAULT_SYSTEM_PROMPT;
        userTemplate = testPrompt.user || DEFAULT_USER_TEMPLATE;
      } else {
        const { data } = await sb
          .from("ai_prompts")
          .select("system_prompt, user_prompt_template, provider")
          .eq("prompt_key", "analyze_feed")
          .eq("active", true)
          .single();

        if (data) {
          // Check provider compatibility
          const providerMatch = data.provider === "all" ||
            (apiType === "intelligence-studio" && data.provider === "intelligence-studio") ||
            (apiType === "openai-compatible" && data.provider === "openai-compatible") ||
            (!apiType || apiType === "builtin") && (data.provider === "builtin" || data.provider === "all");

          if (providerMatch) {
            systemPrompt = data.system_prompt || DEFAULT_SYSTEM_PROMPT;
            userTemplate = data.user_prompt_template || DEFAULT_USER_TEMPLATE;
          }
        }
      }
    } catch (e) {
      console.warn("Could not load prompt from DB, using defaults:", e);
    }

    // Render user prompt from template
    const templateVars = {
      title: title || "",
      description: description || "No description",
      content: content || "No additional content",
      source: source || "Unknown",
      sourceUrl: sourceUrl || "",
    };
    const userPrompt = renderTemplate(userTemplate, templateVars);

    // Only use Intelligence Studio if both endpoint and key are provided
    const hasIntelStudio = apiType === "intelligence-studio" && apiKey?.trim() && endpointUrl?.trim();
    const isIntelStudio = hasIntelStudio;

    const aiUrl = (hasIntelStudio ? endpointUrl?.trim() : null) || (endpointUrl?.trim() && apiKey?.trim() ? endpointUrl.trim() : "https://ai.gateway.lovable.dev/v1/chat/completions");
    const aiKey = (hasIntelStudio ? apiKey?.trim() : null) || apiKey?.trim() || Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey && !endpointUrl?.trim()) throw new Error("LOVABLE_API_KEY is not configured");

    const selectedModel = model || "google/gemini-3-flash-preview";

    let analysisData: any;

    if (isIntelStudio) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (aiKey) {
        if (authHeaderType === "x-api-key") headers["x-api-key"] = aiKey;
        else headers["Authorization"] = `Bearer ${aiKey}`;
      }

      // For Intelligence Studio, combine system + user prompt
      const combinedPrompt = systemPrompt + "\n\n" + userPrompt;

      const response = await fetch(aiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          output_type: "text",
          input_type: "text",
          input_value: combinedPrompt,
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
      const outputText = rawData?.outputs?.[0]?.outputs?.[0]?.results?.message?.text
        || rawData?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message
        || rawData?.result || rawData?.output || rawData?.text
        || (typeof rawData === "string" ? rawData : JSON.stringify(rawData));

      try {
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
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
                    impact_analysis: { type: "string", description: "Impact analysis as bullet points separated by newlines. Each point should start on a new line. Cover potential consequences, attack vectors, and risk level." },
                    affected_versions: { type: "array", items: { type: "string" }, description: "List of affected software/system versions. Empty array if not applicable." },
                    mitigations: { type: "array", items: { type: "string" }, description: "List of recommended mitigation actions and remediation steps" },
                    reference_links: { type: "array", items: { type: "string" }, description: "List of relevant reference URLs" },
                    severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"], description: "Assessed severity level" },
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
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall) {
        const content_text = data.choices?.[0]?.message?.content;
        return new Response(JSON.stringify({ error: "No structured output from AI", raw: content_text }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
