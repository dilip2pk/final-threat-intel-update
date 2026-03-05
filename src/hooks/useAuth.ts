import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "user";

async function fetchRole(userId: string): Promise<AppRole> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return (data?.role as AppRole) || "user";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const initialSessionHandled = useRef(false);

  useEffect(() => {
    let mounted = true;

    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      initialSessionHandled.current = true;

      if (session?.user) {
        const userRole = await fetchRole(session.user.id);
        if (!mounted) return;
        setRole(userRole);
        setSession(session);
        setUser(session.user);
      } else {
        setRole(null);
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    });

    // 2. Listen for auth changes (skip INITIAL_SESSION to avoid race)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Skip INITIAL_SESSION — already handled by getSession above
      if (event === "INITIAL_SESSION") return;

      if (session?.user) {
        setLoading(true);
        const userRole = await fetchRole(session.user.id);
        if (!mounted) return;
        setRole(userRole);
        setSession(session);
        setUser(session.user);
      } else {
        setRole(null);
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRole(null);
  }, []);

  const isAdmin = role === "admin";

  return { user, session, role, isAdmin, loading, signOut };
}
