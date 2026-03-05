import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ExternalLink, Loader2 } from "lucide-react";

interface TopCVE {
  id: string;
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  source_url: string;
  published_date: string;
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

  useEffect(() => {
    supabase
      .from("top_cves")
      .select("*")
      .order("published_date", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        setCves((data as TopCVE[]) || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="border border-border rounded-md bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-semibold text-foreground">Top CVEs</h3>
        <Badge variant="outline" className="ml-auto text-[10px]">{cves.length}</Badge>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        ) : cves.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No CVEs configured yet
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {cves.map((cve) => (
              <li key={cve.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-primary">{cve.cve_id}</span>
                  <Badge className={`text-[10px] border ${severityColor[cve.severity] || severityColor.medium}`}>
                    {cve.severity}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-foreground line-clamp-1">{cve.title}</p>
                {cve.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{cve.description}</p>
                )}
                {cve.source_url && (
                  <a
                    href={cve.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> Source
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
