import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ExternalLink, Loader2, AlertTriangle, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface TopCVE {
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  source_url: string;
  published_date: string;
  vendor?: string;
  product?: string;
  due_date?: string;
  required_action?: string;
}

const severityColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-primary/15 text-primary border-primary/30",
};

export function TopCVEsWidget() {
  const [cves, setCves] = useState<TopCVE[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noUrl, setNoUrl] = useState(false);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    setNoUrl(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("cve-proxy");
      if (fnError) throw new Error(fnError.message);
      if (data?.error === "no_url_configured") {
        setNoUrl(true);
        setCves([]);
        return;
      }
      if (data?.error) throw new Error(data.error);
      setCves(data?.cves || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="border border-border rounded-md bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-semibold text-foreground">Top CVEs</h3>
        <div className="ml-auto flex items-center gap-1.5">
          {!noUrl && (
            <Badge variant="outline" className="text-[10px]">
              {cves.length}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Fetching CVE data...</span>
          </div>
        ) : noUrl ? (
          <div className="py-8 text-center space-y-3 px-4">
            <Settings className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              No CVE source URL configured.
            </p>
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings")}
                className="gap-2"
              >
                <Settings className="h-3.5 w-3.5" /> Configure Source URL
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Ask an administrator to configure a CVE source URL in Settings → Top CVEs.
              </p>
            )}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-xs text-muted-foreground space-y-2 px-4">
            <AlertTriangle className="h-6 w-6 mx-auto text-destructive/60" />
            <p>Failed to load CVEs</p>
            <p className="text-[11px] text-muted-foreground/70">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : cves.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No CVEs found from the configured source
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {cves.map((cve, idx) => (
              <li
                key={`${cve.cve_id}-${idx}`}
                className="px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <a
                    href={cve.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    {cve.cve_id}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  <Badge
                    className={`text-[10px] border ${
                      severityColor[cve.severity] || severityColor.high
                    }`}
                  >
                    {cve.severity}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-foreground line-clamp-1">
                  {cve.title}
                </p>
                {cve.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                    {cve.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  {cve.vendor && (
                    <span className="bg-muted/40 px-1.5 py-0.5 rounded">
                      {cve.vendor}
                      {cve.product ? ` / ${cve.product}` : ""}
                    </span>
                  )}
                  <span>{formatDate(cve.published_date)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
