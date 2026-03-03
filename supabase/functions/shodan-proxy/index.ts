import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SHODAN_API_KEY = Deno.env.get("SHODAN_API_KEY");
    if (!SHODAN_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Shodan API key not configured. Please add it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, type } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apiUrl: string;
    if (type === "host") {
      apiUrl = `https://api.shodan.io/shodan/host/${encodeURIComponent(query)}?key=${SHODAN_API_KEY}`;
    } else if (type === "domain") {
      apiUrl = `https://api.shodan.io/dns/domain/${encodeURIComponent(query)}?key=${SHODAN_API_KEY}`;
    } else {
      apiUrl = `https://api.shodan.io/shodan/host/search?key=${SHODAN_API_KEY}&query=${encodeURIComponent(query)}&minify=true`;
    }

    console.log(`Shodan query: ${type} - ${query}`);

    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Shodan API error [${res.status}]:`, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Shodan API error: ${res.status}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    // Log to audit
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);
      await sb.from("audit_log").insert({
        action: "shodan_search",
        entity_type: "shodan",
        details: { query, type, total: data.total || 0 },
      });
    } catch (e) {
      console.error("Failed to log audit:", e);
    }

    if (type === "host") {
      return new Response(
        JSON.stringify({
          success: true,
          matches: data.data || [],
          total: data.data?.length || 0,
          ip_str: data.ip_str,
          org: data.org,
          os: data.os,
          ports: data.ports,
          vulns: data.vulns ? Object.keys(data.vulns) : [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches: data.matches || [],
        total: data.total || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Shodan proxy error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Shodan search failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
