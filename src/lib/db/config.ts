/**
 * Database Provider Configuration
 * 
 * Controls which backend the app connects to:
 * - "supabase"  → Supabase Cloud / Lovable Cloud (default)
 * - "postgrest" → Standalone PostgreSQL + PostgREST
 * 
 * Set via environment variable: VITE_DB_PROVIDER=postgrest
 */

export type DbProvider = "supabase" | "postgrest";

export const DB_PROVIDER: DbProvider =
  (import.meta.env.VITE_DB_PROVIDER as DbProvider) || "supabase";

/** Base URL for the REST API (Supabase URL or PostgREST URL) */
export const DB_REST_URL: string =
  import.meta.env.VITE_SUPABASE_URL || "http://localhost:3000";

/** Anon / publishable key used for API auth */
export const DB_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

/**
 * Base URL for edge functions / backend API.
 * - Supabase mode:  https://<ref>.supabase.co/functions/v1
 * - PostgREST mode: local tools server (e.g. http://localhost:3002/api)
 */
export const FUNCTIONS_BASE_URL: string =
  import.meta.env.VITE_FUNCTIONS_URL ||
  (DB_PROVIDER === "postgrest"
    ? (import.meta.env.VITE_LOCAL_TOOLS_URL || "http://localhost:3002") + "/api"
    : `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "localhost"}.supabase.co/functions/v1`);

/** Whether we're running in standalone PostgreSQL mode */
export const isStandalone = DB_PROVIDER === "postgrest";

/** Whether Supabase Auth is available */
export const AUTH_ENABLED: boolean =
  import.meta.env.VITE_AUTH_ENABLED !== "false" && !isStandalone;
