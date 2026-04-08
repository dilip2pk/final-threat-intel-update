import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  new URLSearchParams(params).forEach((v, k) => {
    queryParams[k] = v;
  });

  const res = await invokeProxyFunction("rss-proxy", queryParams);

  if (!res.ok) throw new Error(`RSS API error: ${res.status}`);
  return res.json();
}

function sortItemsByDate(items: RSSFeedItem[]) {
  return [...items].sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });
}

function mapLiveResultsToItems(data: Record<string, any>): RSSFeedItem[] {
  const items: RSSFeedItem[] = [];

  for (const [feedId, result] of Object.entries(data) as [string, any][]) {
    const feedName = result.name || feedId;
    for (const item of result.items || []) {
      items.push({
        ...item,
        feedId,
        feedName,
      });
    }
  }

  return sortItemsByDate(items);
}

async function loadCachedItems(): Promise<RSSFeedItem[]> {
  const { data, error } = await supabase
    .from("feed_items_cache" as any)
    .select("id, feed_source_id, feed_name, title, link, description, pub_date, category, content")
    .order("pub_date", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const items = ((data || []) as any[]).map((row) => ({
    id: row.link || row.id,
    title: row.title,
    link: row.link,
    description: row.description || "",
    pubDate: row.pub_date || "",
    category: row.category || "",
    content: row.content || "",
    feedId: row.feed_source_id || "",
    feedName: row.feed_name || "",
  }));

  return sortItemsByDate(items);
}

export function useRSSFeeds() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllFeeds = useCallback(async (): Promise<{ sources: RSSSource[]; items: RSSFeedItem[] }> => {
    setLoading(true);
    setError(null);

    try {
      const liveData = await callRSSProxy("all=true");
      const [cachedItems, sourcesResult] = await Promise.all([
        loadCachedItems(),
        supabase
          .from("feed_sources")
          .select("id, name, url, category, tags, active")
          .order("name", { ascending: true }),
      ]);

      if (sourcesResult.error) throw sourcesResult.error;

      const itemCountByFeed = cachedItems.reduce<Record<string, number>>((acc, item) => {
        if (item.feedId) acc[item.feedId] = (acc[item.feedId] || 0) + 1;
        return acc;
      }, {});

      const sources: RSSSource[] = ((sourcesResult.data || []) as any[]).map((source) => {
        const liveResult = liveData[source.id] || {};
        return {
          id: source.id,
          name: source.name,
          url: source.url,
          category: source.category || liveResult.category || "",
          tags: source.tags || [],
          active: Boolean(source.active) && !liveResult.error,
          itemCount: itemCountByFeed[source.id] || 0,
          error: liveResult.error,
        };
      });

      return {
        sources,
        items: cachedItems.length > 0 ? cachedItems : mapLiveResultsToItems(liveData),
      };
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
