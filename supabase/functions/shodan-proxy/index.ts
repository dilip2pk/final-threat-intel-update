// shodan-proxy v2 — uses SHODAN_API_KEY env var with DB fallback
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getShodanApiKey(bodyApiKey?: string): Promise<string | null> {
  // 1. Use API key from request body if provided (and looks valid: >10 chars)
  if (bodyApiKey && bodyApiKey.trim().length > 10) {
    console.log("Using Shodan key from request body");
    return bodyApiKey.trim();
  }

  // 2. Check environment variable
  const envKey = Deno.env.get("SHODAN_API_KEY");
  if (envKey && envKey.trim().length > 10) {
    console.log("Using Shodan key from environment variable");
    return envKey.trim();
  }

  // 3. Load from app_settings in database
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "integrations")
      .single();
    const dbKey = data?.value?.shodan?.apiKey;
    if (dbKey && dbKey.trim().length > 10) {
      console.log("Using Shodan key from app_settings");
      return dbKey.trim();
    }
  } catch (e) {
    console.error("Failed to load Shodan key from settings:", e);
  }

  console.warn("No valid Shodan API key found in any source");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, type, apiKey: bodyApiKey } = body;

    const SHODAN_API_KEY = await getShodanApiKey(bodyApiKey);
    if (!SHODAN_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Shodan API key not configured. Please add it in Settings → Shodan." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // API key info/test endpoint
    if (type === "info") {
      const res = await fetch(`https://api.shodan.io/api-info?key=${SHODAN_API_KEY}`, {
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) {
        const errText = await res.text();
        return new Response(
          JSON.stringify({ success: false, error: `Invalid API key or Shodan error: ${res.status}` }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const data = await res.json();
      return new Response(
        JSON.stringify({ success: true, plan: data.plan, query_credits: data.query_credits, scan_credits: data.scan_credits }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Shodan query: ${type} - ${query}`);


    // ─── HOST lookup ───────────────────────────────────────────────
    if (type === "host") {
      // Try paid endpoint first
      const paidUrl = `https://api.shodan.io/shodan/host/${encodeURIComponent(query)}?key=${SHODAN_API_KEY}`;
      let res = await fetch(paidUrl, { headers: { "Accept": "application/json" } });

      // Fallback to free InternetDB (no credits required) on 401/403/membership errors
      if (res.status === 401 || res.status === 403) {
        console.log("Paid host endpoint denied — falling back to free InternetDB");
        const freeRes = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(query)}`, {
          headers: { "Accept": "application/json" },
        });
        if (freeRes.ok) {
          const idb = await freeRes.json();
          return new Response(
            JSON.stringify({
              success: true,
              source: "internetdb-free",
              ip_str: idb.ip,
              hostnames: idb.hostnames || [],
              ports: idb.ports || [],
              vulns: idb.vulns || [],
              cpes: idb.cpes || [],
              tags: idb.tags || [],
              matches: [],
              total: 0,
              note: "Using free Shodan InternetDB (limited details). Upgrade Shodan plan for full host data.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await freeRes.text();
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Shodan host error [${res.status}]:`, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Shodan API error: ${res.status} - ${errText.substring(0, 200)}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const data = await res.json();
      return new Response(
        JSON.stringify({
          success: true,
          source: "paid",
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

    // ─── DOMAIN lookup ─────────────────────────────────────────────
    if (type === "domain") {
      const paidUrl = `https://api.shodan.io/dns/domain/${encodeURIComponent(query)}?key=${SHODAN_API_KEY}`;
      let res = await fetch(paidUrl, { headers: { "Accept": "application/json" } });

      // Fallback to free DNS resolve API
      if (res.status === 401 || res.status === 403) {
        console.log("Paid domain endpoint denied — falling back to free DNS resolve");
        const resolveRes = await fetch(
          `https://api.shodan.io/dns/resolve?hostnames=${encodeURIComponent(query)}&key=${SHODAN_API_KEY}`
        );
        if (resolveRes.ok) {
          const resolved = await resolveRes.json();
          return new Response(
            JSON.stringify({
              success: true,
              source: "dns-resolve-free",
              domain: query,
              subdomains: [],
              data: Object.entries(resolved).map(([host, ip]) => ({ subdomain: "", type: "A", value: ip, hostname: host })),
              total: Object.keys(resolved).length,
              note: "Using free Shodan DNS resolve (no subdomains). Upgrade Shodan plan for full domain enumeration.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await resolveRes.text();
      }

      if (!res.ok) {
        const errText = await res.text();
        return new Response(
          JSON.stringify({ success: false, error: `Shodan API error: ${res.status} - ${errText.substring(0, 200)}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const data = await res.json();
      return new Response(
        JSON.stringify({
          success: true,
          source: "paid",
          domain: data.domain,
          subdomains: data.subdomains || [],
          data: data.data || [],
          total: data.data?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SEARCH (default) ──────────────────────────────────────────
    const searchUrl = `https://api.shodan.io/shodan/host/search?key=${SHODAN_API_KEY}&query=${encodeURIComponent(query)}&minify=true`;
    let res = await fetch(searchUrl, { headers: { "Accept": "application/json" } });

    // Fallback to free `count` endpoint + facet stats when no query credits
    if (res.status === 401 || res.status === 403) {
      console.log("Paid search denied — falling back to free count endpoint");
      const countUrl = `https://api.shodan.io/shodan/host/count?key=${SHODAN_API_KEY}&query=${encodeURIComponent(query)}&facets=country,org,port`;
      const countRes = await fetch(countUrl, { headers: { "Accept": "application/json" } });
      if (countRes.ok) {
        const c = await countRes.json();
        // Log audit
        try {
          const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await sb.from("audit_log").insert({
            action: "shodan_search",
            entity_type: "shodan",
            details: { query, type: "search-count-free", total: c.total || 0 },
          });
        } catch (_) { /* noop */ }
        return new Response(
          JSON.stringify({
            success: true,
            source: "count-free",
            matches: [],
            total: c.total || 0,
            facets: c.facets || {},
            note: "Free Shodan plan: showing aggregate counts only. Upgrade for individual host results.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await countRes.text();
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Shodan search error [${res.status}]:`, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Shodan API error: ${res.status} - ${errText.substring(0, 200)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    // Audit log paid search
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.from("audit_log").insert({
        action: "shodan_search",
        entity_type: "shodan",
        details: { query, type, total: data.total || 0 },
      });
    } catch (e) {
      console.error("Failed to log audit:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: "paid",
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
