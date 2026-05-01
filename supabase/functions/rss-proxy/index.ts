import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string;
  content?: string;
}

// ---------- XML / RSS / Atom ----------
function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") : "";
}

function extractAtomLink(block: string): string {
  // Atom uses <link href="..."/>
  const m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1] : "";
}

function parseRSSItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2] || "";
    const title = extractTag(block, "title");
    let link = extractTag(block, "link");
    if (!link || link.startsWith("<")) link = extractAtomLink(block) || extractTag(block, "guid");
    const description = extractTag(block, "description") || extractTag(block, "summary");
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "dc:date");
    const category = extractTag(block, "category");
    const content = extractTag(block, "content:encoded") || extractTag(block, "content");

    if (title) {
      items.push({
        id: link || `${title}-${pubDate}`,
        title: title.replace(/<[^>]*>/g, "").trim(),
        link: link.replace(/<[^>]*>/g, "").trim(),
        description: description.replace(/<[^>]*>/g, "").trim().substring(0, 500),
        pubDate,
        category: category.replace(/<[^>]*>/g, "").trim(),
        content: content.replace(/<[^>]*>/g, "").trim().substring(0, 1000),
      });
    }
  }

  return items;
}

// ---------- JSON Feed / generic JSON ----------
function pick(obj: any, keys: string[]): string {
  for (const k of keys) {
    if (obj && obj[k] != null && typeof obj[k] !== "object") return String(obj[k]);
    if (obj && obj[k] && typeof obj[k] === "object" && obj[k].href) return String(obj[k].href);
  }
  return "";
}

function parseJSONFeed(json: any): FeedItem[] {
  // JSON Feed spec: https://www.jsonfeed.org/
  let arr: any[] = [];
  if (Array.isArray(json)) arr = json;
  else if (Array.isArray(json?.items)) arr = json.items;
  else if (Array.isArray(json?.entries)) arr = json.entries;
  else if (Array.isArray(json?.feed?.entry)) arr = json.feed.entry;
  else if (Array.isArray(json?.posts)) arr = json.posts;
  else if (Array.isArray(json?.articles)) arr = json.articles;
  else if (Array.isArray(json?.data)) arr = json.data;
  else if (Array.isArray(json?.results)) arr = json.results;
  else return [];

  return arr.map((it: any) => {
    const title = pick(it, ["title", "name", "headline", "subject"]) || "Untitled";
    const link = pick(it, ["url", "link", "permalink", "external_url", "canonical_url", "guid"]);
    const description = pick(it, ["summary", "description", "excerpt", "subtitle", "snippet"]) ||
      String(it?.content_text || it?.contentSnippet || "").substring(0, 500);
    const pubDate = pick(it, ["date_published", "published", "pubDate", "publishedAt", "created_at", "date", "updated"]);
    const content = String(it?.content_html || it?.content_text || it?.content || it?.body || "").replace(/<[^>]*>/g, "").substring(0, 1000);
    const category = Array.isArray(it?.tags) ? it.tags.join(", ") : pick(it, ["category", "section"]);
    return {
      id: link || `${title}-${pubDate}`,
      title: String(title).replace(/<[^>]*>/g, "").trim(),
      link: String(link).trim(),
      description: String(description).replace(/<[^>]*>/g, "").trim().substring(0, 500),
      pubDate: String(pubDate),
      category,
      content,
    };
  }).filter(i => i.title);
}

// ---------- HTML parsing ----------
function resolveUrl(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function discoverFeedLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const tag = m[0];
    const typeMatch = tag.match(/type=["']([^"']+)["']/i);
    const relMatch = tag.match(/rel=["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const type = (typeMatch?.[1] || "").toLowerCase();
    const rel = (relMatch?.[1] || "").toLowerCase();
    if (
      rel.includes("alternate") &&
      (type.includes("rss") || type.includes("atom") || type.includes("xml") || type.includes("json"))
    ) {
      links.push(resolveUrl(hrefMatch[1], baseUrl));
    }
  }
  // Common fallback paths
  const guesses = ["/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/index.xml", "/feed/"];
  for (const g of guesses) links.push(resolveUrl(g, baseUrl));
  return [...new Set(links)];
}

function parseHTMLArticles(html: string, baseUrl: string): FeedItem[] {
  const items: FeedItem[] = [];
  const seen = new Set<string>();

  // Try JSON-LD first (commonly used by blogs)
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const arr = Array.isArray(data) ? data : (data["@graph"] || [data]);
      for (const node of arr) {
        const t = node?.["@type"];
        const types = Array.isArray(t) ? t : [t];
        if (types.some((x: string) => /Article|BlogPosting|NewsArticle/i.test(x))) {
          const link = node.url || node.mainEntityOfPage?.["@id"] || node.mainEntityOfPage;
          const title = node.headline || node.name;
          if (link && title && !seen.has(link)) {
            seen.add(link);
            items.push({
              id: link,
              title: String(title),
              link: resolveUrl(String(link), baseUrl),
              description: String(node.description || "").substring(0, 500),
              pubDate: String(node.datePublished || node.dateModified || ""),
              category: Array.isArray(node.keywords) ? node.keywords.join(", ") : String(node.keywords || ""),
              content: "",
            });
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (items.length >= 3) return items;

  // Fallback: extract <article> blocks or anchors from common listing patterns
  const articleRegex = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  while ((m = articleRegex.exec(html)) !== null) {
    const block = m[1];
    const aMatch = block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!aMatch) continue;
    const link = resolveUrl(aMatch[1], baseUrl);
    const title = aMatch[2].replace(/<[^>]*>/g, "").trim();
    if (!title || seen.has(link)) continue;
    const timeMatch = block.match(/<time[^>]*datetime=["']([^"']+)["']/i);
    const descMatch = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    seen.add(link);
    items.push({
      id: link,
      title,
      link,
      description: (descMatch?.[1] || "").replace(/<[^>]*>/g, "").trim().substring(0, 500),
      pubDate: timeMatch?.[1] || "",
      category: "",
      content: "",
    });
  }

  return items;
}

// ---------- Unified fetcher with auto-detection ----------
async function fetchFeed(url: string, timeoutMs = 15000, depth = 0): Promise<{ items: FeedItem[]; error?: string; format?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ThreatFeed/2.0; +https://lovable.dev)",
        "Accept": "application/rss+xml, application/atom+xml, application/feed+json, application/json, application/xml, text/xml, text/html, */*",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const body = await res.text();
    const trimmed = body.trim();

    // 1) JSON
    if (contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const json = JSON.parse(trimmed);
        const items = parseJSONFeed(json);
        if (items.length > 0) return { items, format: "json" };
      } catch { /* not JSON */ }
    }

    // 2) XML / RSS / Atom
    if (contentType.includes("xml") || /<(rss|feed|rdf:RDF)\b/i.test(trimmed.substring(0, 500))) {
      const items = parseRSSItems(body);
      if (items.length > 0) return { items, format: "xml" };
    }

    // 3) HTML — try discover linked feeds, then fall back to scraping
    if (contentType.includes("html") || /<html[\s>]/i.test(trimmed.substring(0, 500))) {
      if (depth === 0) {
        const candidates = discoverFeedLinks(body, url);
        for (const candidate of candidates.slice(0, 6)) {
          const sub = await fetchFeed(candidate, timeoutMs, depth + 1);
          if (sub.items.length > 0) return { items: sub.items, format: `discovered:${sub.format || "feed"}` };
        }
      }
      const items = parseHTMLArticles(body, url);
      if (items.length > 0) return { items, format: "html" };
      return { items: [], error: "No feed or articles could be extracted from this URL" };
    }

    // 4) Last resort try XML parse
    const items = parseRSSItems(body);
    if (items.length > 0) return { items, format: "xml" };
    return { items: [], error: "Unrecognized content format" };
  } catch (e: any) {
    return { items: [], error: e.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fetchAll = url.searchParams.get("all") === "true";
    const testUrl = url.searchParams.get("testUrl");
    const feedUrl = url.searchParams.get("feedUrl");

    if (testUrl) {
      const result = await fetchFeed(testUrl);
      if (result.error && result.items.length === 0) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ count: result.items.length, format: result.format, items: result.items.slice(0, 5) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (feedUrl) {
      const result = await fetchFeed(feedUrl, 15000);
      return new Response(JSON.stringify({ items: result.items, error: result.error, format: result.format }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (fetchAll) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      const { data: sources, error: dbError } = await sb
        .from("feed_sources")
        .select("id, name, url, category, tags, active")
        .eq("active", true);

      if (dbError) {
        console.error("Failed to load feed sources:", dbError);
        return new Response(JSON.stringify({ error: "Failed to load feed sources" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!sources || sources.length === 0) {
        return new Response(JSON.stringify({}), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: Record<string, { items: FeedItem[]; error?: string; name: string; category: string }> = {};

      const promises = sources.map(async (source) => {
        const result = await fetchFeed(source.url);
        results[source.id] = {
          items: result.items,
          error: result.error,
          name: source.name,
          category: source.category || "",
        };

        try {
          await sb.from("feed_sources").update({
            last_fetched: new Date().toISOString(),
            total_items: result.items.length,
          }).eq("id", source.id);
        } catch (e) {
          console.error(`Failed to update feed source ${source.id}:`, e);
        }

        if (result.items.length > 0) {
          try {
            const rows = result.items
              .filter(item => item.link)
              .map(item => ({
                feed_source_id: source.id,
                feed_name: source.name,
                title: item.title,
                link: item.link,
                description: (item.description || "").substring(0, 2000),
                pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
                category: item.category || "",
                content: (item.content || "").substring(0, 5000),
              }));
            await sb.from("feed_items_cache").upsert(rows, {
              onConflict: "feed_source_id,link",
              ignoreDuplicates: false,
            });
          } catch (e) {
            console.error(`Failed to cache items for ${source.name}:`, e);
          }
        }
      });

      await Promise.all(promises);

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Use ?all=true, ?feedUrl=<url>, or ?testUrl=<url>" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("RSS proxy error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch feed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
