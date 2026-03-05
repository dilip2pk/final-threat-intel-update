import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type } = body;

    if (type === "ai") {
      return await testAI(body);
    } else if (type === "servicenow") {
      return await testServiceNow(body);
    } else {
      return new Response(JSON.stringify({ success: false, message: "Unknown connection type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("test-connection error:", e);
    return new Response(JSON.stringify({ success: false, message: e instanceof Error ? e.message : "Test failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function testAI(params: any) {
  const { model, endpointUrl, apiKey, timeout, apiType, authHeaderType } = params;
  const timeoutMs = parseInt(timeout || "30") * 1000;
  const isIntelStudio = apiType === "intelligence-studio";

  // Use custom endpoint or default Lovable AI
  const url = endpointUrl?.trim() || "https://ai.gateway.lovable.dev/v1/chat/completions";
  const key = apiKey?.trim() || (endpointUrl?.trim() ? "" : Deno.env.get("LOVABLE_API_KEY"));

  // Only require key for built-in gateway, not for local endpoints
  if (!key && !endpointUrl?.trim()) {
    return jsonResponse({ success: false, message: "No API key configured." });
  }

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (key) {
      if (authHeaderType === "x-api-key" || isIntelStudio) {
        headers["x-api-key"] = key;
      } else {
        headers["Authorization"] = `Bearer ${key}`;
      }
    }

    let requestBody: string;
    if (isIntelStudio) {
      requestBody = JSON.stringify({
        output_type: "text",
        input_type: "text",
        input_value: "Reply with exactly: CONNECTION_OK",
        session_id: `test_${Date.now()}`,
      });
    } else {
      requestBody = JSON.stringify({
        model: model || "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: "Reply with exactly: CONNECTION_OK" }],
        max_tokens: 20,
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ success: false, message: `API returned ${response.status}: ${errorText.slice(0, 200)}` });
    }

    const data = await response.json();

    let content = "";
    if (isIntelStudio) {
      content = data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text
        || data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message
        || data?.result || data?.output || data?.text
        || (typeof data === "string" ? data : "Response received");
    } else {
      content = data.choices?.[0]?.message?.content || "";
    }

    return jsonResponse({
      success: true,
      message: `Connected successfully. ${isIntelStudio ? "Intelligence Studio" : `Model: ${model || "default"}`}. Response: "${String(content).slice(0, 50)}"`,
      latencyMs,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return jsonResponse({ success: false, message: `Connection timed out after ${timeoutMs / 1000}s` });
    }
    return jsonResponse({ success: false, message: `Connection failed: ${e.message}` });
  }
}

async function testServiceNow(params: any) {
  const { instanceUrl, username, password, apiKey, authMethod } = params;

  if (!instanceUrl) {
    return jsonResponse({ success: false, message: "Instance URL is required" });
  }

  const url = `${instanceUrl.replace(/\/$/, "")}/api/now/table/sys_properties?sysparm_limit=1`;

  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (authMethod === "bearer" && apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (username && password) {
    headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
  } else {
    return jsonResponse({ success: false, message: "Missing authentication credentials" });
  }

  try {
    const response = await fetch(url, { method: "GET", headers });

    if (response.ok) {
      return jsonResponse({ success: true, message: "Connected to ServiceNow successfully" });
    } else if (response.status === 401 || response.status === 403) {
      return jsonResponse({ success: false, message: `Authentication failed (${response.status}). Check credentials.` });
    } else {
      return jsonResponse({ success: false, message: `ServiceNow returned ${response.status}` });
    }
  } catch (e: any) {
    return jsonResponse({ success: false, message: `Connection failed: ${e.message}` });
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
