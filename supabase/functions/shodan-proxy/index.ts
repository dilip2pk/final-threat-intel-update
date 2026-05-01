// shodan-proxy v4 — free-tier fallbacks (InternetDB, count, DNS resolve) + caching + domain enrichment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache TTL for free-tier responses (15 minutes)
const FREE_TIER_CACHE_TTL_MS = 15 * 60 * 1000;

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getShodanApiKey(bodyApiKey?: string): Promise<string | null> {
  if (bodyApiKey && bodyApiKey.trim().length > 10) return bodyApiKey.trim();
  const envKey = Deno.env.get("SHODAN_API_KEY");
  if (envKey && envKey.trim().length > 10) return envKey.trim();
  try {
    const sb = getSupabase();
    const { data } = await sb.from("app_settings").select("value").eq("key", "integrations").single();
    const dbKey = data?.value?.shodan?.apiKey;
    if (dbKey && dbKey.trim().length > 10) return dbKey.trim();
  } catch (e) {
    console.error("Failed to load Shodan key from settings:", e);
  }
  return null;
}

function cacheKey(type: string, query: string): string {
  return `${type}::${query.trim().toLowerCase()}`;
}

async function readCache(type: string, query: string) {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from("shodan_cache")
      .select("response, expires_at, source, total")
      .eq("cache_key", cacheKey(type, query))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return data?.response ?? null;
  } catch (e) {
    console.error("Cache read failed:", e);
    return null;
  }
}

async function writeCache(type: string, query: string, source: string, response: any, total: number) {
  try {
    const sb = getSupabase();
    const expires = new Date(Date.now() + FREE_TIER_CACHE_TTL_MS).toISOString();
    await sb.from("shodan_cache").upsert(
      {
        cache_key: cacheKey(type, query),
        query,
        query_type: type,
        source,
        response,
        total,
        expires_at: expires,
      },
      { onConflict: "cache_key" }
    );
  } catch (e) {
    console.error("Cache write failed:", e);
  }
}

// Enrich a domain free-tier resolve with InternetDB lookups for each resolved IP
async function enrichDomainFromInternetDB(domain: string, resolved: Record<string, string>) {
  const ips = Array.from(new Set(Object.values(resolved).filter(Boolean) as string[]));
  if (ips.length === 0) return { matches: [], hosts: [] };

  const results = await Promise.allSettled(
    ips.map(async (ip) => {
      const r = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
        headers: { "Accept": "application/json" },
      });
      if (!r.ok) return null;
      const j = await r.json();
      return {
        ip_str: j.ip || ip,
        hostnames: j.hostnames || [],
        ports: j.ports || [],
        vulns: j.vulns || [],
        cpes: j.cpes || [],
        tags: j.tags || [],
      };
    })
  );

  const hosts = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean) as any[];

  // Flatten into Shodan-style "matches" so the UI's result list renders something
  const matches = hosts.flatMap((h) => {
    const ports: number[] = h.ports?.length ? h.ports : [0];
    return ports.map((p) => ({
      ip_str: h.ip_str,
      port: p || undefined,
      hostnames: h.hostnames,
      vulns: h.vulns,
      transport: "tcp",
      org: undefined,
      product: h.cpes?.[0],
    }));
  });

  return { matches, hosts };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, type, apiKey: bodyApiKey, bypassCache } = body;

    const SHODAN_API_KEY = await getShodanApiKey(bodyApiKey);
    if (!SHODAN_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Shodan API key not configured. Please add it in Settings → Shodan." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "info") {
      const res = await fetch(`https://api.shodan.io/api-info?key=${SHODAN_API_KEY}`);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid API key: ${res.status}` }),
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

    console.log(`Shodan query: ${type} - ${query} (bypassCache=${!!bypassCache})`);

    // ─── Cache check (free-tier results only) ──────────────────────
    if (!bypassCache) {
      const cached = await readCache(type, query);
      if (cached) {
        console.log(`Cache hit for ${type}::${query}`);
        return new Response(
          JSON.stringify({ ...cached, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── HOST lookup ───────────────────────────────────────────────
    if (type === "host") {
      const paidUrl = `https://api.shodan.io/shodan/host/${encodeURIComponent(query)}?key=${SHODAN_API_KEY}`;
      const res = await fetch(paidUrl, { headers: { "Accept": "application/json" } });

      if (res.status === 401 || res.status === 403) {
        const freeRes = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(query)}`, {
          headers: { "Accept": "application/json" },
        });
        if (freeRes.ok) {
          const idb = await freeRes.json();
          const payload = {
            success: true,
            source: "internetdb-free",
            ip_str: idb.ip,
            hostnames: idb.hostnames || [],
            ports: idb.ports || [],
            vulns: idb.vulns || [],
            cpes: idb.cpes || [],
            tags: idb.tags || [],
            matches: (idb.ports || []).map((p: number) => ({
              ip_str: idb.ip,
              port: p,
              transport: "tcp",
              hostnames: idb.hostnames || [],
              vulns: idb.vulns || [],
            })),
            total: (idb.ports || []).length,
            note: "Using free Shodan InternetDB (limited details). Upgrade Shodan plan for full host data.",
          };
          await writeCache(type, query, payload.source, payload, payload.total);
          return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await freeRes.text();
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
          success: true, source: "paid",
          matches: data.data || [], total: data.data?.length || 0,
          ip_str: data.ip_str, org: data.org, os: data.os, ports: data.ports,
          vulns: data.vulns ? Object.keys(data.vulns) : [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DOMAIN lookup ─────────────────────────────────────────────
    if (type === "domain") {
      const paidUrl = `https://api.shodan.io/dns/domain/${encodeURIComponent(query)}?key=${SHODAN_API_KEY}`;
      const res = await fetch(paidUrl, { headers: { "Accept": "application/json" } });

      if (res.status === 401 || res.status === 403) {
        // Free tier: resolve hostname → enrich each IP via InternetDB
        const candidates = Array.from(new Set([
          query,
          `www.${query}`,
          `mail.${query}`,
          `api.${query}`,
        ]));
        const resolveRes = await fetch(
          `https://api.shodan.io/dns/resolve?hostnames=${candidates.map(encodeURIComponent).join(",")}&key=${SHODAN_API_KEY}`
        );

        let resolved: Record<string, string> = {};
        if (resolveRes.ok) {
          resolved = await resolveRes.json();
        } else {
          await resolveRes.text();
        }

        const { matches, hosts } = await enrichDomainFromInternetDB(query, resolved);

        const payload = {
          success: true,
          source: "dns-resolve-free",
          domain: query,
          subdomains: Object.keys(resolved).filter((h) => h !== query).map((h) => h.replace(`.${query}`, "")),
          data: Object.entries(resolved).map(([host, ip]) => ({
            subdomain: host === query ? "" : host.replace(`.${query}`, ""),
            type: "A",
            value: ip,
            hostname: host,
          })),
          matches,
          hosts,
          total: matches.length || Object.keys(resolved).length,
          note: matches.length
            ? "Free tier: DNS-resolved IPs enriched with Shodan InternetDB (no credits used)."
            : Object.keys(resolved).length
              ? "Free tier: DNS resolved but no Shodan InternetDB data exists for these IPs."
              : `Free tier: domain "${query}" did not resolve. Check spelling or try a hostname like www.${query}.`,
        };
        await writeCache(type, query, payload.source, payload, payload.total);
        return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
          success: true, source: "paid",
          domain: data.domain, subdomains: data.subdomains || [],
          data: data.data || [], total: data.data?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SEARCH (default) ──────────────────────────────────────────
    const searchUrl = `https://api.shodan.io/shodan/host/search?key=${SHODAN_API_KEY}&query=${encodeURIComponent(query)}&minify=true`;
    const res = await fetch(searchUrl, { headers: { "Accept": "application/json" } });

    if (res.status === 401 || res.status === 403) {
      const countUrl = `https://api.shodan.io/shodan/host/count?key=${SHODAN_API_KEY}&query=${encodeURIComponent(query)}&facets=country,org,port`;
      const countRes = await fetch(countUrl, { headers: { "Accept": "application/json" } });
      if (countRes.ok) {
        const c = await countRes.json();
        try {
          const sb = getSupabase();
          await sb.from("audit_log").insert({
            action: "shodan_search", entity_type: "shodan",
            details: { query, type: "search-count-free", total: c.total || 0 },
          });
        } catch (_) { /* noop */ }
        const payload = {
          success: true,
          source: "count-free",
          matches: [],
          total: c.total || 0,
          facets: c.facets || {},
          note: "Free Shodan plan: showing aggregate counts only. Upgrade for individual host results.",
        };
        await writeCache("search", query, payload.source, payload, payload.total);
        return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await countRes.text();
    }

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ success: false, error: `Shodan API error: ${res.status} - ${errText.substring(0, 200)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    try {
      const sb = getSupabase();
      await sb.from("audit_log").insert({
        action: "shodan_search", entity_type: "shodan",
        details: { query, type, total: data.total || 0 },
      });
    } catch (e) { console.error("Audit log failed:", e); }

    return new Response(
      JSON.stringify({
        success: true, source: "paid",
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
