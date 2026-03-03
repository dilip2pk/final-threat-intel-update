import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Allowed RSS feed URLs
const ALLOWED_FEEDS: Record<string, string> = {
  "cisa": "https://www.cisa.gov/news.xml",
  "nvd": "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml",
  "krebs": "https://krebsonsecurity.com/feed/",
  "microsoft": "https://msrc.microsoft.com/blog/feed",
  "talos": "https://blog.talosintelligence.com/rss/",
  "hackernews": "https://feeds.feedburner.com/TheHackersNews",
  "cvefeed_high": "https://cvefeed.io/rssfeed/severity/high.xml",
  "cvefeed_critical": "https://cvefeed.io/rssfeed/severity/critical.xml",
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

function extractTag(xml: string, tag: string): string {
  // Try CDATA first
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") : "";
}

function parseRSSItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  // Match <item> or <entry> blocks
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2] || "";
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || extractTag(block, "guid");
    const description = extractTag(block, "description") || extractTag(block, "summary");
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "dc:date");
    const category = extractTag(block, "category");
    const content = extractTag(block, "content:encoded") || extractTag(block, "content");

    if (title) {
      items.push({
        id: link || `${title}-${pubDate}`,
        title: title.replace(/<[^>]*>/g, ""),
        link: link.replace(/<[^>]*>/g, ""),
        description: description.replace(/<[^>]*>/g, "").substring(0, 500),
        pubDate,
        category: category.replace(/<[^>]*>/g, ""),
        content: content.replace(/<[^>]*>/g, "").substring(0, 1000),
      });
    }
  }

  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const feedId = url.searchParams.get("feed");
    const fetchAll = url.searchParams.get("all") === "true";

    if (fetchAll) {
      // Fetch all feeds in parallel
      const results: Record<string, { items: FeedItem[]; error?: string }> = {};

      const entries = Object.entries(ALLOWED_FEEDS);
      const promises = entries.map(async ([id, feedUrl]) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(feedUrl, {
            headers: { "User-Agent": "ThreatFeed/1.0", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!res.ok) {
            results[id] = { items: [], error: `HTTP ${res.status}` };
            return;
          }
          const xml = await res.text();
          results[id] = { items: parseRSSItems(xml) };
        } catch (e: any) {
          results[id] = { items: [], error: e.message };
        }
      });

      await Promise.all(promises);

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!feedId || !ALLOWED_FEEDS[feedId]) {
      return new Response(
        JSON.stringify({ error: "Invalid feed ID", available: Object.keys(ALLOWED_FEEDS) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const feedUrl = ALLOWED_FEEDS[feedId];
    console.log(`Fetching RSS feed: ${feedId} -> ${feedUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "ThreatFeed/1.0", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Feed returned HTTP ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const xml = await res.text();
    const items = parseRSSItems(xml);

    return new Response(JSON.stringify({ feed: feedId, url: feedUrl, count: items.length, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("RSS proxy error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch RSS feed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
