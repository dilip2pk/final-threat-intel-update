import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, description } = await req.json();
    if (!description?.trim()) throw new Error("Description is required");
    if (!["nmap", "shodan"].includes(type)) throw new Error("Type must be 'nmap' or 'shodan'");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = type === "nmap"
      ? `You are an expert network security engineer specializing in Nmap. The user will describe what they want to scan or discover. Generate the best nmap command(s) for their use case. You MUST respond using the generate_commands tool. Always provide practical, ready-to-use commands. Include the target placeholder as <TARGET> if no specific target is mentioned. For each command, explain what it does and when to use it.`
      : `You are an expert in Shodan search queries and dorks. The user will describe what they want to find on the internet. Generate the best Shodan search queries for their use case. You MUST respond using the generate_commands tool. Include both simple queries and advanced dorks where applicable. Explain what each query finds.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_commands",
              description: `Generate ${type === "nmap" ? "nmap commands" : "Shodan queries"} based on the user's description.`,
              parameters: {
                type: "object",
                properties: {
                  commands: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        command: { type: "string", description: type === "nmap" ? "The full nmap command" : "The Shodan search query" },
                        title: { type: "string", description: "Short title for this command (3-6 words)" },
                        explanation: { type: "string", description: "What this command does and when to use it" },
                        difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                      },
                      required: ["command", "title", "explanation", "difficulty"],
                      additionalProperties: false,
                    },
                  },
                  tip: { type: "string", description: "A general tip or best practice related to the user's request" },
                },
                required: ["commands", "tip"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_commands" } },
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
      throw new Error("AI command generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-command error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Command generation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
