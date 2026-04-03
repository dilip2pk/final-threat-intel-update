import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface ThreatIntelIOC {
  id: string;
  ioc_type: string;
  ioc_value: string;
  source_feed_id: string | null;
  source_feed_name: string;
  source_article_url: string;
  source_article_title: string;
  confidence: number;
  context: string;
  tags: string[];
  first_seen: string;
  last_seen: string;
  sighting_count: number;
  is_whitelisted: boolean;
  created_at: string;
}

export interface ThreatIntelReport {
  id: string;
  source_feed_id: string | null;
  source_feed_name: string;
  source_article_url: string;
  source_article_title: string;
  report_type: string;
  summary: string;
  threat_actors: string[];
  ttps: string[];
  affected_sectors: string[];
  affected_products: string[];
  severity: string;
  ai_model_used: string;
  related_ioc_ids: string[];
  tags: string[];
  created_at: string;
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

export function useThreatIntel() {
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<any>(null);
  const qc = useQueryClient();

  const iocsQuery = useQuery({
    queryKey: ["threat-intel-iocs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threat_intel_iocs" as any)
        .select("*")
        .eq("is_whitelisted", false)
        .order("last_seen", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as ThreatIntelIOC[];
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["threat-intel-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threat_intel_reports" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as ThreatIntelReport[];
    },
  });

  const statsQuery = useQuery({
    queryKey: ["threat-intel-processing-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threat_intel_processing_log" as any)
        .select("status")
        .limit(1000);
      if (error) throw error;
      const items = (data || []) as any[];
      return {
        total: items.length,
        completed: items.filter(i => i.status === 'completed').length,
        failed: items.filter(i => i.status === 'failed').length,
        pending: items.filter(i => i.status === 'pending').length,
      } as ProcessingStats;
    },
  });

  const runProcessing = useCallback(async (options?: {
    mode?: 'auto' | 'manual';
    feed_source_id?: string;
    skip_ai?: boolean;
    deep_scrape?: boolean;
  }) => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const { invokeProxyFunction } = await import("@/lib/db");
      const res = await invokeProxyFunction("threat-intel-process", {});
      // invokeProxyFunction uses GET with query params, but we need POST
      // Use supabase functions invoke instead
      const { data, error } = await supabase.functions.invoke("threat-intel-process", {
        body: {
          mode: options?.mode || 'auto',
          feed_source_id: options?.feed_source_id,
          skip_ai: options?.skip_ai,
          deep_scrape: options?.deep_scrape,
        },
      });
      if (error) throw error;
      setProcessResult(data);
      // Refresh all queries
      qc.invalidateQueries({ queryKey: ["threat-intel-iocs"] });
      qc.invalidateQueries({ queryKey: ["threat-intel-reports"] });
      qc.invalidateQueries({ queryKey: ["threat-intel-processing-stats"] });
      return data;
    } catch (e: any) {
      setProcessResult({ error: e.message });
      throw e;
    } finally {
      setProcessing(false);
    }
  }, [qc]);

  const whitelistIOC = useCallback(async (id: string) => {
    await supabase
      .from("threat_intel_iocs" as any)
      .update({ is_whitelisted: true } as any)
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["threat-intel-iocs"] });
  }, [qc]);

  return {
    iocs: iocsQuery.data || [],
    reports: reportsQuery.data || [],
    processingStats: statsQuery.data || { total: 0, completed: 0, failed: 0, pending: 0 },
    isLoadingIOCs: iocsQuery.isLoading,
    isLoadingReports: reportsQuery.isLoading,
    processing,
    processResult,
    runProcessing,
    whitelistIOC,
    refresh: () => {
      qc.invalidateQueries({ queryKey: ["threat-intel-iocs"] });
      qc.invalidateQueries({ queryKey: ["threat-intel-reports"] });
      qc.invalidateQueries({ queryKey: ["threat-intel-processing-stats"] });
    },
  };
}
