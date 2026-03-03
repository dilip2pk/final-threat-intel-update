import { useState, useCallback } from "react";

export interface RSSFeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string;
  content?: string;
  feedId: string;
  feedName: string;
}

export interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string;
  tags: string[];
  active: boolean;
  itemCount: number;
  error?: string;
}

const FEED_META: Record<string, { name: string; category: string; tags: string[] }> = {
  cisa: { name: "CISA Alerts", category: "Government", tags: ["cisa", "gov", "advisory"] },
  nvd: { name: "NVD CVE Feed", category: "Vulnerability DB", tags: ["nvd", "cve", "vulnerability"] },
  krebs: { name: "Krebs on Security", category: "Security Blog", tags: ["blog", "news", "analysis"] },
  microsoft: { name: "Microsoft Security", category: "Vendor Advisory", tags: ["microsoft", "patch", "advisory"] },
  talos: { name: "Cisco Talos", category: "Threat Intel", tags: ["cisco", "talos", "malware"] },
  hackernews: { name: "The Hacker News", category: "Security Blog", tags: ["news", "hacking", "breach"] },
  cvefeed_high: { name: "CVE Feed (High)", category: "CVE", tags: ["cve", "high", "vulnerability"] },
  cvefeed_critical: { name: "CVE Feed (Critical)", category: "CVE", tags: ["cve", "critical", "vulnerability"] },
};

const FEED_URLS: Record<string, string> = {
  cisa: "https://www.cisa.gov/news.xml",
  nvd: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml",
  krebs: "https://krebsonsecurity.com/feed/",
  microsoft: "https://msrc.microsoft.com/blog/feed",
  talos: "https://blog.talosintelligence.com/rss/",
  hackernews: "https://feeds.feedburner.com/TheHackersNews",
  cvefeed_high: "https://cvefeed.io/rssfeed/severity/high.xml",
  cvefeed_critical: "https://cvefeed.io/rssfeed/severity/critical.xml",
};

async function callRSSProxy(params: string) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/rss-proxy?${params}`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  );

  if (!res.ok) throw new Error(`RSS API error: ${res.status}`);
  return res.json();
}

export function useRSSFeeds() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllFeeds = useCallback(async (): Promise<{ sources: RSSSource[]; items: RSSFeedItem[] }> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callRSSProxy("all=true");
      const sources: RSSSource[] = [];
      const items: RSSFeedItem[] = [];

      for (const [feedId, result] of Object.entries(data) as [string, any][]) {
        const meta = FEED_META[feedId];
        if (!meta) continue;

        sources.push({
          id: feedId,
          name: meta.name,
          url: FEED_URLS[feedId],
          category: meta.category,
          tags: meta.tags,
          active: !result.error,
          itemCount: result.items?.length || 0,
          error: result.error,
        });

        if (result.items) {
          for (const item of result.items) {
            items.push({
              ...item,
              feedId,
              feedName: meta.name,
            });
          }
        }
      }

      // Sort items by date descending
      items.sort((a, b) => {
        const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return db - da;
      });

      return { sources, items };
    } catch (e: any) {
      setError(e.message);
      return { sources: [], items: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSingleFeed = useCallback(async (feedId: string): Promise<RSSFeedItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callRSSProxy(`feed=${feedId}`);
      const meta = FEED_META[feedId];
      return (data.items || []).map((item: any) => ({
        ...item,
        feedId,
        feedName: meta?.name || feedId,
      }));
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, fetchAllFeeds, fetchSingleFeed };
}
