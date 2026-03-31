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

async function callRSSProxy(params: string) {
  const { invokeProxyFunction } = await import("@/lib/db");
  const queryParams: Record<string, string> = {};
  new URLSearchParams(params).forEach((v, k) => { queryParams[k] = v; });

  const res = await invokeProxyFunction("rss-proxy", queryParams);

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
        const name = result.name || feedId;
        const category = result.category || "";

        sources.push({
          id: feedId,
          name,
          url: "",
          category,
          tags: [],
          active: !result.error,
          itemCount: result.items?.length || 0,
          error: result.error,
        });

        if (result.items) {
          for (const item of result.items) {
            items.push({
              ...item,
              feedId,
              feedName: name,
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

  const fetchSingleFeed = useCallback(async (feedUrl: string, feedName: string): Promise<RSSFeedItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callRSSProxy(`feedUrl=${encodeURIComponent(feedUrl)}`);
      return (data.items || []).map((item: any) => ({
        ...item,
        feedId: feedUrl,
        feedName,
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
