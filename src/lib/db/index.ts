/**
 * Database Abstraction Layer
 * 
 * Central export for all DB-related utilities.
 * Import from here instead of directly from supabase/client for new code.
 * 
 * Usage:
 *   import { db, invokeFunction, isStandalone } from "@/lib/db";
 * 
 * The `db` export is the Supabase client — it works identically with
 * both Supabase Cloud and standalone PostgREST since the JS client
 * is a PostgREST wrapper.
 */

// Re-export the Supabase client as `db` for cleaner abstraction
export { supabase as db } from "@/integrations/supabase/client";

// Provider config
export { DB_PROVIDER, DB_REST_URL, DB_ANON_KEY, FUNCTIONS_BASE_URL, isStandalone, AUTH_ENABLED } from "./config";

// Function invocation
export { invokeFunction, invokeProxyFunction } from "./functions";
