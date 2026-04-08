import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RSSFeedItem } from "./useRSSFeeds";

export function useCachedFeeds(options?: {
  feedSourceId?: string;
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["cached-feed-items", options?.feedSourceId, options?.search, options?.limit],
    queryFn: async (): Promise<RSSFeedItem[]> => {
      let query = supabase
        .from("feed_items_cache" as any)
        .select("*")
        .order("pub_date", { ascending: false })
        .limit(options?.limit || 500);

      if (options?.feedSourceId) {
        query = query.eq("feed_source_id", options.feedSourceId);
      }

      if (options?.search) {
        query = query.ilike("title", `%${options.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return ((data || []) as any[]).map((row) => ({
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
    },
    staleTime: 60_000,
  });
}
