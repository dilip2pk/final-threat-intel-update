import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceHealth {
  name: string;
  status: "healthy" | "unhealthy" | "checking" | "unknown";
  message?: string;
  latencyMs?: number;
  version?: string;
}

export interface HealthCheckResult {
  services: ServiceHealth[];
  overallStatus: "healthy" | "degraded" | "unhealthy" | "checking";
  checkedAt: Date | null;
}

const VITE_LOCAL_NMAP_URL = import.meta.env.VITE_LOCAL_NMAP_URL || "";
const VITE_LOCAL_TOOLS_URL = import.meta.env.VITE_LOCAL_TOOLS_URL || "";

export function useHealthCheck() {
  const [result, setResult] = useState<HealthCheckResult>({
    services: [],
    overallStatus: "unknown",
    checkedAt: null,
  });
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async (nmapUrl?: string, toolsUrl?: string) => {
    setChecking(true);
    const services: ServiceHealth[] = [];

    // Check Supabase/Database
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("app_settings").select("key").limit(1);
      if (error) throw error;
      services.push({
        name: "Database",
        status: "healthy",
        message: "Connected",
        latencyMs: Date.now() - dbStart,
      });
    } catch (e: any) {
      services.push({
        name: "Database",
        status: "unhealthy",
        message: e.message || "Connection failed",
        latencyMs: Date.now() - dbStart,
      });
    }

    // Check Auth
    const authStart = Date.now();
    try {
      const { data } = await supabase.auth.getSession();
      services.push({
        name: "Auth Service",
        status: "healthy",
        message: data.session ? "Authenticated" : "Anonymous",
        latencyMs: Date.now() - authStart,
      });
    } catch (e: any) {
      services.push({
        name: "Auth Service",
        status: "unhealthy",
        message: e.message || "Auth check failed",
        latencyMs: Date.now() - authStart,
      });
    }

    // Check Nmap Server (local or from env)
    const nmapEndpoint = nmapUrl || VITE_LOCAL_NMAP_URL;
    if (nmapEndpoint) {
      const nmapStart = Date.now();
      try {
        const resp = await fetch(`${nmapEndpoint.replace(/\/$/, "")}/api/health`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        const data = await resp.json();
        const isHealthy = data.status === "ok" || data.nmap || (data.tools && Object.values(data.tools as Record<string, any>).some((t: any) => t.available));
        services.push({
          name: "Nmap Server",
          status: isHealthy ? "healthy" : "unhealthy",
          message: isHealthy ? `Online${data.version ? ` (${data.version})` : ""}` : "No tools available",
          latencyMs: Date.now() - nmapStart,
          version: data.version || data.server_version,
        });
      } catch (e: any) {
        services.push({
          name: "Nmap Server",
          status: "unhealthy",
          message: e.message || "Unreachable",
          latencyMs: Date.now() - nmapStart,
        });
      }
    }

    // Check Tools Server (local or from env)
    const toolsEndpoint = toolsUrl || VITE_LOCAL_TOOLS_URL;
    if (toolsEndpoint && toolsEndpoint !== nmapEndpoint) {
      const toolsStart = Date.now();
      try {
        const resp = await fetch(`${toolsEndpoint.replace(/\/$/, "")}/api/health`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        const data = await resp.json();
        const availableTools = data.tools ? Object.values(data.tools as Record<string, any>).filter((t: any) => t.available).length : 0;
        const totalTools = data.total_plugins || (data.tools ? Object.keys(data.tools).length : 0);
        services.push({
          name: "Tools Server",
          status: data.status === "ok" ? "healthy" : "unhealthy",
          message: `${availableTools}/${totalTools} tools available`,
          latencyMs: Date.now() - toolsStart,
          version: data.server_version,
        });
      } catch (e: any) {
        services.push({
          name: "Tools Server",
          status: "unhealthy",
          message: e.message || "Unreachable",
          latencyMs: Date.now() - toolsStart,
        });
      }
    }

    // Determine overall status
    const healthyCount = services.filter(s => s.status === "healthy").length;
    let overallStatus: HealthCheckResult["overallStatus"] = "healthy";
    if (healthyCount === 0) overallStatus = "unhealthy";
    else if (healthyCount < services.length) overallStatus = "degraded";

    setResult({
      services,
      overallStatus,
      checkedAt: new Date(),
    });
    setChecking(false);

    return { services, overallStatus };
  }, []);

  return { result, checking, checkHealth };
}
