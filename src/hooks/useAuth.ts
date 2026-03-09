import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/apiClient";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "user";

/**
 * Fetches the role for a given user from the user_roles table.
 * Returns "user" as default if no role is found.
 */
async function fetchRole(userId: string): Promise<AppRole> {
  try {
    const { data } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    return (data?.role as AppRole) || "user";
  } catch {
    return "user";
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const roleCache = useRef<Map<string, AppRole>>(new Map());

  useEffect(() => {
    let mounted = true;

    async function handleSession(newSession: Session | null) {
      if (!mounted) return;

      if (newSession?.user) {
        const userId = newSession.user.id;

        // Use cached role if available to prevent flash
        const cached = roleCache.current.get(userId);
        if (cached) {
          setRole(cached);
          setSession(newSession);
          setUser(newSession.user);
          setLoading(false);
        }

        // Always fetch fresh role from DB
        const freshRole = await fetchRole(userId);
        if (!mounted) return;

        roleCache.current.set(userId, freshRole);
        setRole(freshRole);
        setSession(newSession);
        setUser(newSession.user);
      } else {
        setRole(null);
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    }

    // 1. Get initial session first
    db.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSession(initialSession);
    });

    // 2. Listen for subsequent auth changes only (skip INITIAL_SESSION)
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, newSession) => {
      if (event === "INITIAL_SESSION") return;

      // Set loading immediately on sign-in to prevent any role flash
      if (newSession?.user) {
        setLoading(true);
      }

      // Use setTimeout to avoid blocking the auth state change callback
      // This prevents potential deadlocks per Supabase best practices
      setTimeout(() => {
        handleSession(newSession);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    roleCache.current.clear();
    await supabase.auth.signOut();
    setRole(null);
  }, []);

  const isAdmin = role === "admin";

  return { user, session, role, isAdmin, loading, signOut };
}
