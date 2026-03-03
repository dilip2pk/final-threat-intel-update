import { useState, useCallback } from "react";

export interface RansomLookPost {
  group_name: string;
  post_title: string;
  discovered: string;
  description?: string;
  website?: string;
}

export interface RansomLookGroup {
  name: string;
  locations?: { fqdn: string; title: string; available: boolean }[];
  profile?: string[];
  meta?: string;
}

async function callProxy(endpoint: string) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/ransomlook-proxy?endpoint=${encodeURIComponent(endpoint)}`,
    {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export function useRansomLookAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentPosts = useCallback(async (count = 100): Promise<RansomLookPost[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callProxy(`/api/recent/${count}`);
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLastDays = useCallback(async (days = 7): Promise<RansomLookPost[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callProxy(`/api/last/${days}`);
      // API returns object keyed by group name with arrays of posts
      if (typeof data === "object" && !Array.isArray(data)) {
        const posts: RansomLookPost[] = [];
        for (const [groupName, groupPosts] of Object.entries(data)) {
          if (Array.isArray(groupPosts)) {
            for (const post of groupPosts as any[]) {
              posts.push({
                group_name: post.group_name || groupName,
                post_title: post.post_title || "",
                discovered: post.discovered || "",
                description: post.description,
                website: post.website,
              });
            }
          }
        }
        return posts;
      }
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async (): Promise<string[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callProxy("/api/groups");
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroupInfo = useCallback(async (name: string): Promise<RansomLookGroup | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callProxy(`/api/group/${encodeURIComponent(name)}`);
      // API returns an array with one element containing group data
      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw) return null;
      return {
        name: raw.name || name,
        locations: raw.locations || [],
        profile: raw.profile || [],
        meta: raw.meta || raw.description || "",
      };
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPosts = useCallback(async (query: string, days = 90): Promise<RansomLookPost[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callProxy(`/api/last/${days}`);
      const posts: RansomLookPost[] = [];
      if (typeof data === "object" && !Array.isArray(data)) {
        for (const [groupName, groupPosts] of Object.entries(data)) {
          if (Array.isArray(groupPosts)) {
            for (const post of groupPosts as any[]) {
              posts.push({
                group_name: post.group_name || groupName,
                post_title: post.post_title || "",
                discovered: post.discovered || "",
                description: post.description,
                website: post.website,
              });
            }
          }
        }
      } else if (Array.isArray(data)) {
        posts.push(...data);
      }

      if (!query.trim()) return posts;

      const q = query.toLowerCase();
      return posts.filter(
        (p) =>
          p.post_title?.toLowerCase().includes(q) ||
          p.group_name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.website?.toLowerCase().includes(q)
      );
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchRecentPosts,
    fetchLastDays,
    fetchGroups,
    fetchGroupInfo,
    searchPosts,
  };
}
