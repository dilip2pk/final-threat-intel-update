import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Parse a simple cron expression into milliseconds interval.
 * Supports common patterns like:
 *   "*/5 * * * *"  → every 5 minutes
 *   "*/30 * * * *" → every 30 minutes
 *   "0 * * * *"    → every hour
 *   "0 */2 * * *"  → every 2 hours
 * Falls back to 30 minutes for unsupported patterns.
 */
function cronToMs(cron: string): number {
  const DEFAULT_MS = 30 * 60 * 1000; // 30 min
  if (!cron) return DEFAULT_MS;

  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return DEFAULT_MS;

  const [minute, hour] = parts;

  // Every N minutes: */N * * * *
  if (minute.startsWith("*/") && hour === "*") {
    const n = parseInt(minute.slice(2), 10);
    if (!isNaN(n) && n > 0) return n * 60 * 1000;
  }

  // Every hour: 0 * * * *
  if (minute === "0" && hour === "*") {
    return 60 * 60 * 1000;
  }

  // Every N hours: 0 */N * * * or * */N * * *
  if (hour.startsWith("*/")) {
    const n = parseInt(hour.slice(2), 10);
    if (!isNaN(n) && n > 0) return n * 60 * 60 * 1000;
  }

  return DEFAULT_MS;
}

interface UseAutoFetchFeedsOptions {
  enabled: boolean;
  onFetch: () => Promise<void>;
}

export function useAutoFetchFeeds({ enabled, onFetch }: UseAutoFetchFeedsOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [intervalMs, setIntervalMs] = useState<number>(30 * 60 * 1000);
  const [nextFetchAt, setNextFetchAt] = useState<Date | null>(null);
  const onFetchRef = useRef(onFetch);
  onFetchRef.current = onFetch;

  // Load fetch interval from settings
  useEffect(() => {
    async function loadInterval() {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "general")
          .single();
        if (data?.value) {
          const val = data.value as any;
          const ms = cronToMs(val.fetchInterval || "");
          setIntervalMs(ms);
        }
      } catch (e) {
        console.error("Failed to load fetch interval:", e);
      }
    }
    loadInterval();
  }, []);

  // Set up the recurring timer
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setNextFetchAt(null);
      return;
    }

    // Don't auto-fetch more often than every 1 minute
    const safeMs = Math.max(intervalMs, 60 * 1000);

    const updateNext = () => setNextFetchAt(new Date(Date.now() + safeMs));
    updateNext();

    intervalRef.current = setInterval(() => {
      console.log(`[AutoFetch] Refreshing feeds (interval: ${safeMs / 1000}s)`);
      onFetchRef.current();
      updateNext();
    }, safeMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, intervalMs]);

  return { intervalMs, nextFetchAt };
}
