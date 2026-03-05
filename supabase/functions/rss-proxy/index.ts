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

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") : "";
}

function parseRSSItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
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

async function fetchFeed(url: string, timeoutMs = 10000): Promise<{ items: FeedItem[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": "ThreatFeed/1.0", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    const xml = await res.text();
    return { items: parseRSSItems(xml) };
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

    // Test a custom feed URL
    if (testUrl) {
      const result = await fetchFeed(testUrl);
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ count: result.items.length, items: result.items.slice(0, 5) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch a single feed by URL
    if (feedUrl) {
      const result = await fetchFeed(feedUrl, 15000);
      return new Response(JSON.stringify({ items: result.items, error: result.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (fetchAll) {
      // Load configured feed sources from database
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

      // Fetch all configured feeds in parallel
      const results: Record<string, { items: FeedItem[]; error?: string; name: string; category: string }> = {};

      const promises = sources.map(async (source) => {
        const result = await fetchFeed(source.url);
        results[source.id] = {
          ...result,
          name: source.name,
          category: source.category || "",
        };

        // Update last_fetched and total_items
        try {
          await sb.from("feed_sources").update({
            last_fetched: new Date().toISOString(),
            total_items: result.items.length,
          }).eq("id", source.id);
        } catch (e) {
          console.error(`Failed to update feed source ${source.id}:`, e);
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
    return new Response(JSON.stringify({ error: "Failed to fetch RSS feed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
