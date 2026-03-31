/**
 * Edge Function / Backend API abstraction
 * 
 * In Supabase mode: uses supabase.functions.invoke()
 * In PostgREST mode: calls local HTTP endpoints
 */

import { supabase } from "@/integrations/supabase/client";
import { DB_PROVIDER, FUNCTIONS_BASE_URL, DB_ANON_KEY } from "./config";

export interface FunctionResponse<T = any> {
  data: T | null;
  error: Error | null;
}

/**
 * Invoke a backend function by name.
 * Automatically routes to Supabase Functions or local HTTP endpoints.
 */
export async function invokeFunction<T = any>(
  functionName: string,
  body?: Record<string, any>,
  options?: { method?: string; queryParams?: Record<string, string> }
): Promise<FunctionResponse<T>> {
  if (DB_PROVIDER === "supabase") {
    return supabase.functions.invoke(functionName, { body }) as Promise<FunctionResponse<T>>;
  }

  // PostgREST / standalone mode → call local HTTP endpoint
  try {
    const url = new URL(`${FUNCTIONS_BASE_URL}/${functionName}`);
    if (options?.queryParams) {
      Object.entries(options.queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method: options?.method || (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(DB_ANON_KEY ? { Authorization: `Bearer ${DB_ANON_KEY}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      return { data: null, error: new Error(`Function ${functionName} returned ${res.status}`) };
    }

    const data = await res.json();
    return { data: data as T, error: null };
  } catch (e: any) {
    return { data: null, error: e };
  }
}

/**
 * Call a proxy-style function via GET with query parameters.
 * Works for rss-proxy, ransomlook-proxy, cve-proxy, shodan-proxy, etc.
 */
export async function invokeProxyFunction(
  functionName: string,
  queryParams: Record<string, string>
): Promise<Response> {
  if (DB_PROVIDER === "supabase") {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const params = new URLSearchParams(queryParams).toString();
    return fetch(
      `https://${projectId}.supabase.co/functions/v1/${functionName}?${params}`,
      {
        headers: {
          apikey: DB_ANON_KEY,
          Authorization: `Bearer ${DB_ANON_KEY}`,
        },
      }
    );
  }

  // Standalone mode
  const url = new URL(`${FUNCTIONS_BASE_URL}/${functionName}`);
  Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url.toString(), {
    headers: DB_ANON_KEY ? { Authorization: `Bearer ${DB_ANON_KEY}` } : {},
  });
}
