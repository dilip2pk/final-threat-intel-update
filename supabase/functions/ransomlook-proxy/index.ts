import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RANSOMLOOK_BASE = "https://www.ransomlook.io";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Whitelist allowed endpoints to prevent SSRF
    const allowedPrefixes = [
      "/api/recent",
      "/api/last",
      "/api/groups",
      "/api/group/",
      "/api/posts",
      "/api/post/",
      "/api/leaks/leaks",
      "/api/rf/leaks",
      "/api/rf/leak/",
    ];

    const isAllowed = allowedPrefixes.some((prefix) => endpoint.startsWith(prefix));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: "Endpoint not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = `${RANSOMLOOK_BASE}${endpoint}`;
    console.log(`Proxying request to: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch from RansomLook API" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
