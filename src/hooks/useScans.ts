import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Scan {
  id: string;
  target: string;
  target_type: string;
  scan_type: string;
  ports: string;
  timing_template: string;
  enable_scripts: boolean;
  custom_options: string;
  status: string;
  initiated_by: string;
  started_at: string | null;
  completed_at: string | null;
  result_summary: any;
  error_message: string | null;
  ai_analysis: any;
  created_at: string;
  updated_at: string;
}

export interface ScanResult {
  id: string;
  scan_id: string;
  host: string;
  host_status: string;
  os_detection: string | null;
  ports: any[];
  vulnerabilities: any[];
  raw_output: string | null;
  created_at: string;
}

export interface ScanSchedule {
  id: string;
  name: string;
  target: string;
  target_type: string;
  scan_type: string;
  ports: string;
  timing_template: string;
  enable_scripts: boolean;
  custom_options: string;
  frequency: string;
  cron_expression: string;
  notify_email: boolean;
  auto_ticket: boolean;
  auto_ai_analysis: boolean;
  active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export function useScans() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchScans = useCallback(async () => {
    const { data, error } = await supabase
      .from("scans")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setScans(data as unknown as Scan[]);
    if (error) console.error("Error fetching scans:", error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchScans();
    // Subscribe to realtime updates
    const channel = supabase
      .channel("scans-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "scans" }, () => {
        fetchScans();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchScans]);

  const startScan = async (params: {
    target: string;
    target_type: string;
    scan_type: string;
    ports?: string;
    timing_template?: string;
    enable_scripts?: boolean;
    custom_options?: string;
  }) => {
    // Parse multiple targets
    const targets = params.target.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
    if (targets.length === 0) throw new Error("No targets specified");

    // Insert scan record
    const { data: scan, error } = await supabase.from("scans").insert({
      target: params.target,
      target_type: params.target_type,
      scan_type: params.scan_type,
      ports: params.ports || "",
      timing_template: params.timing_template || "T3",
      enable_scripts: params.enable_scripts || false,
      custom_options: params.custom_options || "",
      status: "pending",
      initiated_by: "user",
    } as any).select().single();

    if (error) throw error;
    if (!scan) throw new Error("Failed to create scan");

    // Trigger the scan
    const { error: fnError } = await supabase.functions.invoke("port-scan", {
      body: {
        scanId: (scan as any).id,
        targets,
        scanType: params.scan_type,
        ports: params.ports,
        timingTemplate: params.timing_template,
      },
    });

    if (fnError) {
      await supabase.from("scans").update({ status: "failed", error_message: fnError.message } as any).eq("id", (scan as any).id);
      throw fnError;
    }

    return scan;
  };

  const analyzeScan = async (scanId: string, model?: string) => {
    const { data, error } = await supabase.functions.invoke("analyze-scan", {
      body: { scanId, model },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Analysis failed");
    await fetchScans();
    return data.analysis;
  };

  const getScanResults = async (scanId: string): Promise<ScanResult[]> => {
    const { data } = await supabase
      .from("scan_results")
      .select("*")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true });
    return (data as unknown as ScanResult[]) || [];
  };

  const deleteScan = async (scanId: string) => {
    await supabase.from("scans").delete().eq("id", scanId);
    setScans(prev => prev.filter(s => s.id !== scanId));
  };

  return { scans, loading, startScan, analyzeScan, getScanResults, deleteScan, refetch: fetchScans };
}

export function useScanSchedules() {
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("scan_schedules").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setSchedules(data as unknown as ScanSchedule[]);
      setLoading(false);
    });
  }, []);

  const addSchedule = async (schedule: Omit<ScanSchedule, "id" | "created_at" | "last_run_at" | "next_run_at">) => {
    const { data, error } = await supabase.from("scan_schedules").insert(schedule as any).select().single();
    if (error) throw error;
    if (data) setSchedules(prev => [data as unknown as ScanSchedule, ...prev]);
    return data;
  };

  const toggleSchedule = async (id: string, active: boolean) => {
    await supabase.from("scan_schedules").update({ active } as any).eq("id", id);
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, active } : s));
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from("scan_schedules").delete().eq("id", id);
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  return { schedules, loading, addSchedule, toggleSchedule, deleteSchedule };
}
