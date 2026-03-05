import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduledJob {
  id: string;
  name: string;
  job_type: string;
  configuration: any;
  frequency: string;
  cron_expression: string;
  active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function useScheduledJobs() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from("scheduled_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setJobs(data as unknown as ScheduledJob[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const addJob = async (job: Partial<ScheduledJob>) => {
    const { data, error } = await supabase
      .from("scheduled_jobs")
      .insert(job as any)
      .select()
      .single();
    if (error) throw error;
    if (data) setJobs(prev => [data as unknown as ScheduledJob, ...prev]);
    return data;
  };

  const updateJob = async (id: string, updates: Partial<ScheduledJob>) => {
    const { error } = await supabase
      .from("scheduled_jobs")
      .update(updates as any)
      .eq("id", id);
    if (error) throw error;
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const deleteJob = async (id: string) => {
    await supabase.from("scheduled_jobs").delete().eq("id", id);
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const toggleJob = async (id: string, active: boolean) => {
    await updateJob(id, { active });
  };

  const runJobNow = async (job: ScheduledJob) => {
    // Mark as running
    await updateJob(job.id, { last_status: "running" } as any);
    
    try {
      if (job.job_type === "shodan_scan") {
        const config = job.configuration;
        const { data, error } = await supabase.functions.invoke("shodan-proxy", {
          body: { query: config.query, type: config.queryType || "search" },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || "Search failed");
        
        // Save results
        if (config.savedQueryId) {
          await supabase.from("shodan_results").insert({
            query_id: config.savedQueryId,
            result_data: data,
          });
        }
        
        await updateJob(job.id, { 
          last_run_at: new Date().toISOString(), 
          last_status: "completed",
          last_error: null,
        } as any);
        return data;
      }
        // Trigger network scan
        const config = job.configuration;
        const { data: scan, error } = await supabase.from("scans").insert({
          target: config.target,
          target_type: config.targetType || "ip",
          scan_type: config.scanType || "quick",
          ports: config.ports || "",
          timing_template: config.timingTemplate || "T3",
          enable_scripts: config.enableScripts || false,
          custom_options: config.customOptions || "",
          status: "pending",
          initiated_by: "scheduler",
        } as any).select().single();
        
        if (error) throw error;
        
        // Trigger the scan
        await supabase.functions.invoke("port-scan", {
          body: {
            scanId: (scan as any).id,
            targets: config.target.split(/[\n,;]+/).map((t: string) => t.trim()).filter(Boolean),
            scanType: config.scanType || "quick",
            ports: config.ports,
            timingTemplate: config.timingTemplate,
          },
        });
        
        await updateJob(job.id, { 
          last_run_at: new Date().toISOString(), 
          last_status: "completed",
          last_error: null,
        } as any);
        return scan;
      }
    } catch (e: any) {
      await updateJob(job.id, { 
        last_run_at: new Date().toISOString(), 
        last_status: "failed",
        last_error: e.message,
      } as any);
      throw e;
    }
  };

  return { jobs, loading, addJob, updateJob, deleteJob, toggleJob, runJobNow, refetch: fetchJobs };
}
