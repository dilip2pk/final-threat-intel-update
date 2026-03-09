import { useEffect } from "react";
import { useHealthCheck, ServiceHealth } from "@/hooks/useHealthCheck";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthCheckPanelProps {
  nmapUrl?: string;
  toolsUrl?: string;
  autoCheck?: boolean;
}

const StatusIcon = ({ status }: { status: ServiceHealth["status"] }) => {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-severity-low" />;
    case "unhealthy":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "checking":
      return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-severity-medium" />;
  }
};

const StatusBadge = ({ status }: { status: ServiceHealth["status"] }) => {
  const colors = {
    healthy: "bg-severity-low/10 text-severity-low border-severity-low/20",
    unhealthy: "bg-destructive/10 text-destructive border-destructive/20",
    checking: "bg-muted text-muted-foreground border-border",
    unknown: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", colors[status])}>
      {status}
    </span>
  );
};

export function HealthCheckPanel({ nmapUrl, toolsUrl, autoCheck = false }: HealthCheckPanelProps) {
  const { result, checking, checkHealth } = useHealthCheck();

  useEffect(() => {
    if (autoCheck) {
      checkHealth(nmapUrl, toolsUrl);
    }
  }, [autoCheck, nmapUrl, toolsUrl, checkHealth]);

  const overallColors = {
    healthy: "border-severity-low/30 bg-severity-low/5",
    degraded: "border-severity-medium/30 bg-severity-medium/5",
    unhealthy: "border-destructive/30 bg-destructive/5",
    checking: "border-border bg-muted/50",
  };

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={cn("rounded-lg border p-4", overallColors[result.overallStatus])}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-semibold">Docker Services Health</h4>
              <p className="text-xs text-muted-foreground">
                {result.checkedAt
                  ? `Last checked: ${result.checkedAt.toLocaleTimeString()}`
                  : "Not checked yet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={checking ? "checking" : result.overallStatus as ServiceHealth["status"]} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkHealth(nmapUrl, toolsUrl)}
              disabled={checking}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", checking && "animate-spin")} />
              {checking ? "Checking..." : "Check Now"}
            </Button>
          </div>
        </div>
      </div>

      {/* Service List */}
      {result.services.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {result.services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusIcon status={service.status} />
                  <div>
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{service.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {service.version && (
                    <span className="font-mono">v{service.version}</span>
                  )}
                  {service.latencyMs !== undefined && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {service.latencyMs}ms
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {result.services.length === 0 && !checking && (
        <div className="text-center py-8 text-muted-foreground">
          <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Click "Check Now" to verify service connectivity</p>
        </div>
      )}
    </div>
  );
}
