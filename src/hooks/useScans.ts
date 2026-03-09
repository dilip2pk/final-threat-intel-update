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

/** Load nmap backend config from app_settings */
async function getNmapBackendConfig(): Promise<{ mode: string; localUrl: string; apiKey: string }> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "integrations")
      .single();
    if (data?.value) {
      const val = data.value as any;
      return {
        mode: val?.nmapBackend?.mode || "cloud",
        localUrl: val?.nmapBackend?.localUrl || "http://localhost:3001",
        apiKey: val?.nmapBackend?.apiKey || "",
      };
    }
  } catch {}
  return { mode: "cloud", localUrl: "http://localhost:3001", apiKey: "" };
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
    const isRaw = params.scan_type === "raw";
    const targets = isRaw ? [params.target] : params.target.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
    if (!isRaw && targets.length === 0) throw new Error("No targets specified");
    if (isRaw && !params.custom_options?.trim()) throw new Error("No command specified");

    // Insert scan record in DB
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

    const scanId = (scan as any).id;

    // Determine backend
    const config = await getNmapBackendConfig();

    if (config.mode === "local") {
      // Use local Nmap server
      startLocalScan(scanId, targets, params, config).catch(err => {
        console.error("Local scan error:", err);
        supabase.from("scans").update({ status: "failed", error_message: err.message } as any).eq("id", scanId);
        toast({ title: "Scan Failed", description: err.message, variant: "destructive" });
      });
    } else {
      // Use cloud edge function
      supabase.functions.invoke("port-scan", {
        body: {
          scanId,
          targets,
          scanType: params.scan_type,
          ports: params.ports,
          timingTemplate: params.timing_template,
        },
      }).then(({ error: fnError }) => {
        if (fnError) {
          console.error("Scan function error:", fnError);
          supabase.from("scans").update({ status: "failed", error_message: fnError.message } as any).eq("id", scanId);
          toast({ title: "Scan Failed", description: fnError.message, variant: "destructive" });
        }
      }).catch(err => {
        console.error("Scan invocation error:", err);
        supabase.from("scans").update({ status: "failed", error_message: err.message } as any).eq("id", scanId);
      });
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

/** Execute scan via local Nmap server and save results to DB */
async function startLocalScan(
  scanId: string,
  targets: string[],
  params: { scan_type: string; ports?: string; timing_template?: string; enable_scripts?: boolean; custom_options?: string },
  config: { localUrl: string; apiKey: string }
) {
  const baseUrl = config.localUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
  if (config.apiKey) headers["x-api-key"] = config.apiKey;

  // Mark as running
  await supabase.from("scans").update({ status: "running", started_at: new Date().toISOString() } as any).eq("id", scanId);

  // Call local server (synchronous endpoint)
  const isRaw = params.scan_type === "raw";
  const resp = await fetch(`${baseUrl}/api/scan`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      scanId,
      targets: isRaw ? [] : targets,
      scanType: params.scan_type,
      ports: params.ports,
      timingTemplate: params.timing_template,
      enableScripts: params.enable_scripts,
      customOptions: isRaw ? undefined : params.custom_options,
      rawCommand: isRaw ? params.custom_options : undefined,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Server error" }));
    throw new Error(err.error || `Local server returned ${resp.status}`);
  }

  const data = await resp.json();

  if (!data.success) {
    throw new Error(data.error || "Scan failed");
  }

  // Save results to DB
  for (const result of data.results || []) {
    await supabase.from("scan_results").insert({
      scan_id: scanId,
      host: result.host,
      host_status: result.host_status,
      os_detection: result.os_detection,
      ports: result.ports,
      vulnerabilities: result.vulnerabilities,
    } as any);
  }

  // Update scan as completed
  await supabase.from("scans").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    result_summary: data.summary,
  } as any).eq("id", scanId);
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
