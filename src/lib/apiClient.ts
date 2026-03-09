/**
 * API Client Abstraction Layer
 * 
 * Provides a unified interface that mirrors the Supabase SDK.
 * Switches between Supabase (cloud) and local Express API based on VITE_BACKEND_MODE.
 * 
 * Usage: import { db } from "@/lib/apiClient";
 *        db.from("scans").select("*").eq("status", "completed")
 */

import { supabase } from "@/integrations/supabase/client";

const BACKEND_MODE = import.meta.env.VITE_BACKEND_MODE || "supabase";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ══════════════════════════════════════════
// Local API client (mirrors Supabase SDK)
// ══════════════════════════════════════════

function getToken(): string | null {
  return window.localStorage.getItem("local_auth_token");
}

function setToken(token: string | null) {
  if (token) window.localStorage.setItem("local_auth_token", token);
  else window.localStorage.removeItem("local_auth_token");
}

function getUserData(): any {
  const raw = window.localStorage.getItem("local_auth_user");
  return raw ? JSON.parse(raw) : null;
}

function setUserData(user: any) {
  if (user) window.localStorage.setItem("local_auth_user", JSON.stringify(user));
  else window.localStorage.removeItem("local_auth_user");
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  return res;
}

// Chainable query builder for local mode
class LocalQueryBuilder {
  private table: string;
  private filters: Record<string, string> = {};
  private orderCol?: string;
  private orderAsc = true;
  private limitVal?: number;
  private singleVal = false;
  private selectCols = "*";
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private body?: any;

  constructor(table: string) {
    this.table = table;
  }

  select(cols = "*") {
    this.selectCols = cols;
    this.method = "GET";
    return this;
  }

  insert(data: any) {
    this.body = data;
    this.method = "POST";
    return this;
  }

  update(data: any) {
    this.body = data;
    this.method = "PATCH";
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }) {
    this.body = data;
    this.method = "POST";
    this.filters._onConflict = options?.onConflict || "key";
    // Special: upsert path
    (this as any)._isUpsert = true;
    return this;
  }

  delete() {
    this.method = "DELETE";
    return this;
  }

  eq(col: string, val: any) {
    this.filters[col] = String(val);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  single() {
    this.singleVal = true;
    return this;
  }

  maybeSingle() {
    this.singleVal = true;
    return this;
  }

  async then(resolve: (val: any) => void, reject?: (err: any) => void) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (e) {
      if (reject) reject(e);
      else resolve({ data: null, error: { message: (e as Error).message } });
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(this.filters)) {
      if (!k.startsWith("_")) params.set(k, v);
    }
    if (this.selectCols !== "*") params.set("_select", this.selectCols);
    if (this.orderCol) {
      params.set("_order", this.orderCol);
      params.set("_ascending", String(this.orderAsc));
    }
    if (this.limitVal) params.set("_limit", String(this.limitVal));
    if (this.singleVal) params.set("_single", "true");

    const isUpsert = (this as any)._isUpsert;
    const path = isUpsert
      ? `/api/db/${this.table}/upsert?${params.toString()}`
      : `/api/db/${this.table}?${params.toString()}`;

    const options: RequestInit = { method: this.method };
    if (this.body && (this.method === "POST" || this.method === "PATCH")) {
      options.body = JSON.stringify(this.body);
    }

    const res = await apiFetch(path, options);
    const json = await res.json();
    return json;
  }
}

// Auth adapter for local mode
const localAuth = {
  _listeners: new Set<(event: string, session: any) => void>(),

  async getSession() {
    const token = getToken();
    if (!token) return { data: { session: null } };

    try {
      const res = await apiFetch("/api/auth/session");
      const data = await res.json();
      if (data.user) {
        return { data: { session: { ...data.session, access_token: token } } };
      }
    } catch {}
    return { data: { session: null } };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.error) return { data: { user: null, session: null }, error: { message: data.error } };

    setToken(data.session.access_token);
    setUserData(data.user);

    // Notify listeners
    for (const cb of localAuth._listeners) cb("SIGNED_IN", data.session);
    return { data, error: null };
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: any } }) {
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, data: options?.data }),
    });
    const data = await res.json();
    if (data.error) return { data: { user: null, session: null }, error: { message: data.error } };

    setToken(data.session.access_token);
    setUserData(data.user);

    for (const cb of localAuth._listeners) cb("SIGNED_IN", data.session);
    return { data, error: null };
  },

  async signOut() {
    setToken(null);
    setUserData(null);
    for (const cb of localAuth._listeners) cb("SIGNED_OUT", null);
    return { error: null };
  },

  async resetPasswordForEmail(email: string, _opts?: any) {
    const res = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    return { data, error: data.error ? { message: data.error } : null };
  },

  async updateUser(updates: any) {
    const res = await apiFetch("/api/auth/user", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return { data, error: data.error ? { message: data.error } : null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    localAuth._listeners.add(callback);

    // Fire initial session check
    setTimeout(async () => {
      const { data } = await localAuth.getSession();
      callback("INITIAL_SESSION", data.session);
    }, 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            localAuth._listeners.delete(callback);
          },
        },
      },
    };
  },
};

// Functions adapter for local mode
const localFunctions = {
  async invoke(name: string, options?: { body?: any }) {
    try {
      const method = name === "rss-proxy" || name === "ransomlook-proxy" ? "GET" : "POST";
      let path = `/api/functions/${name}`;

      if (method === "GET" && options?.body) {
        const params = new URLSearchParams(options.body);
        path += `?${params.toString()}`;
      }

      const res = await apiFetch(path, {
        method,
        ...(method === "POST" && options?.body ? { body: JSON.stringify(options.body) } : {}),
      });

      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error || `HTTP ${res.status}` } };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  },
};

// Storage adapter for local mode
const localStorageAdapter = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File) {
        const formData = new FormData();
        formData.append("file", file);
        const token = getToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/api/storage/${bucket}/upload?path=${encodeURIComponent(path)}`, {
          method: "POST",
          headers,
          body: formData,
        });
        const data = await res.json();
        return { data, error: data.error ? { message: data.error } : null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: `${API_URL}/api/storage/${bucket}/${path}` } };
      },
      async remove(paths: string[]) {
        for (const p of paths) {
          await apiFetch(`/api/storage/${bucket}/${p}`, { method: "DELETE" });
        }
        return { data: null, error: null };
      },
      async list() {
        const res = await apiFetch(`/api/storage/${bucket}`);
        const data = await res.json();
        return { data: data.data, error: null };
      },
    };
  },
};

// Channel stub for local mode (no realtime)
function localChannel(name: string) {
  return {
    on(_event: string, _filter: any, _cb: any) { return this; },
    subscribe() { return this; },
  };
}

// ══════════════════════════════════════════
// Local client (assembles all adapters)
// ══════════════════════════════════════════
const localClient = {
  from: (table: string) => new LocalQueryBuilder(table),
  auth: localAuth,
  functions: localFunctions,
  storage: localStorageAdapter,
  channel: localChannel,
  removeChannel: (_channel: any) => {},
};

// ══════════════════════════════════════════
// Export the appropriate client
// ══════════════════════════════════════════
export const db: typeof supabase = BACKEND_MODE === "local" ? (localClient as any) : supabase;

// Re-export for convenience
export const isLocalMode = BACKEND_MODE === "local";
export const apiUrl = API_URL;
