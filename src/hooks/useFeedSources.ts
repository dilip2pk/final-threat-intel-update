import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: string;
  tags: string[];
  active: boolean;
  last_fetched: string | null;
  total_items: number;
  created_at: string;
  updated_at: string;
}

export function useFeedSources() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("feed_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setSources(data);
    } catch (e) {
      console.error("Failed to load feed sources:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addSource = useCallback(async (source: { name: string; url: string; category: string; tags: string[]; active: boolean }) => {
    const { data, error } = await supabase
      .from("feed_sources")
      .insert(source)
      .select()
      .single();
    if (data) setSources(prev => [data, ...prev]);
    return { data, error };
  }, []);

  const updateSource = useCallback(async (id: string, updates: Partial<FeedSource>) => {
    const { error } = await supabase
      .from("feed_sources")
      .update(updates)
      .eq("id", id);
    if (!error) setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    return { error };
  }, []);

  const deleteSource = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("feed_sources")
      .delete()
      .eq("id", id);
    if (!error) setSources(prev => prev.filter(s => s.id !== id));
    return { error };
  }, []);

  const testFeedUrl = useCallback(async (url: string) => {
    try {
      const { invokeProxyFunction } = await import("@/lib/db");
      const res = await invokeProxyFunction("rss-proxy", { testUrl: url });
      if (!res.ok) return { success: false, message: `HTTP ${res.status}` };
      const data = await res.json();
      if (data.error) return { success: false, message: data.error };
      return { success: true, message: `Found ${data.count || data.items?.length || 0} items` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }, []);

  return { sources, loading, addSource, updateSource, deleteSource, testFeedUrl, reload: load };
}
