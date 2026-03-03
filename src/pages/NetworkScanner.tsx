import { useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Play, Brain, Download, Trash2, Clock, Shield, Server,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, FileText,
  Calendar, Plus, ToggleLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useScans, useScanSchedules, type Scan, type ScanResult } from "@/hooks/useScans";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const SCAN_TYPES = [
  { value: "quick", label: "Quick Scan", desc: "Top 20 common ports" },
  { value: "full", label: "Full Port Scan", desc: "Extended port range (~40 ports)" },
  { value: "service", label: "Service Detection", desc: "Identify running services" },
  { value: "vuln", label: "Vulnerability Scan", desc: "NSE-style checks" },
  { value: "custom", label: "Custom Scan", desc: "Advanced options" },
];

const TIMING_TEMPLATES = [
  { value: "T1", label: "T1 — Sneaky (slowest)" },
  { value: "T2", label: "T2 — Polite" },
  { value: "T3", label: "T3 — Normal (default)" },
  { value: "T4", label: "T4 — Aggressive" },
  { value: "T5", label: "T5 — Insane (fastest)" },
];

function severityColor(s: string) {
  switch (s) {
    case "critical": return "bg-[hsl(var(--severity-critical))]/10 text-[hsl(var(--severity-critical))] border-[hsl(var(--severity-critical))]/30";
    case "high": return "bg-[hsl(var(--severity-high))]/10 text-[hsl(var(--severity-high))] border-[hsl(var(--severity-high))]/30";
    case "medium": return "bg-[hsl(var(--severity-medium))]/10 text-[hsl(var(--severity-medium))] border-[hsl(var(--severity-medium))]/30";
    case "low": return "bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))] border-[hsl(var(--severity-low))]/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "running": return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 animate-pulse">Running</Badge>;
    case "completed": return <Badge variant="outline" className="bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))] border-[hsl(var(--severity-low))]/30">Completed</Badge>;
    case "failed": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Failed</Badge>;
    case "cancelled": return <Badge variant="outline" className="bg-muted text-muted-foreground">Cancelled</Badge>;
    default: return <Badge variant="outline" className="bg-muted text-muted-foreground">Pending</Badge>;
  }
}

export default function NetworkScanner() {
  const { scans, loading, startScan, analyzeScan, getScanResults, deleteScan } = useScans();
  const { schedules, addSchedule, toggleSchedule, deleteSchedule } = useScanSchedules();
  const { general } = useSettings();
  const { toast } = useToast();

  // Scan form
  const [target, setTarget] = useState("");
  const [targetType, setTargetType] = useState("ip");
  const [scanType, setScanType] = useState("quick");
  const [ports, setPorts] = useState("");
  const [timing, setTiming] = useState("T3");
  const [enableScripts, setEnableScripts] = useState(false);
  const [customOptions, setCustomOptions] = useState("");
  const [scanning, setScanning] = useState(false);

  // Results view
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  // Schedule dialog
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedFreq, setSchedFreq] = useState("once");
  const [schedCron, setSchedCron] = useState("");
  const [schedNotify, setSchedNotify] = useState(false);
  const [schedAutoTicket, setSchedAutoTicket] = useState(false);
  const [schedAutoAI, setSchedAutoAI] = useState(true);

  // Export
  const [exporting, setExporting] = useState(false);

  const handleStartScan = async () => {
    if (!target.trim()) return;
    setScanning(true);
    try {
      await startScan({ target, target_type: targetType, scan_type: scanType, ports, timing_template: timing, enable_scripts: enableScripts, custom_options: customOptions });
      toast({ title: "Scan Started", description: "Port scan is now running" });
    } catch (e: any) {
      toast({ title: "Scan Failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleViewResults = async (scan: Scan) => {
    setSelectedScan(scan);
    setLoadingResults(true);
    setExpandedHosts(new Set());
    const results = await getScanResults(scan.id);
    setScanResults(results);
    setLoadingResults(false);
  };

  const handleAnalyze = async () => {
    if (!selectedScan) return;
    setAnalyzing(true);
    try {
      await analyzeScan(selectedScan.id);
      // Refresh scan data
      const { data } = await supabase.from("scans").select("*").eq("id", selectedScan.id).single();
      if (data) setSelectedScan(data as unknown as Scan);
      toast({ title: "Analysis Complete", description: "AI security analysis is ready" });
    } catch (e: any) {
      toast({ title: "Analysis Failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = async (fmt: "html" | "csv") => {
    if (!selectedScan) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scan-report", {
        body: {
          scanId: selectedScan.id,
          format: fmt,
          branding: {
            logoUrl: general.logoUrl || "",
            orgName: "ThreatIntel",
            disclaimer: "Confidential — for authorized personnel only.",
          },
        },
      });

      if (error) throw new Error(error.message);

      const blob = new Blob([data], { type: fmt === "csv" ? "text/csv" : "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scan-report-${selectedScan.id.slice(0, 8)}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Report Downloaded" });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!schedName || !target.trim()) return;
    try {
      await addSchedule({
        name: schedName,
        target,
        target_type: targetType,
        scan_type: scanType,
        ports,
        timing_template: timing,
        enable_scripts: enableScripts,
        custom_options: customOptions,
        frequency: schedFreq,
        cron_expression: schedCron,
        notify_email: schedNotify,
        auto_ticket: schedAutoTicket,
        auto_ai_analysis: schedAutoAI,
        active: true,
      });
      setScheduleDialog(false);
      setSchedName("");
      toast({ title: "Schedule Created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const toggleHost = (host: string) => {
    setExpandedHosts(prev => {
      const next = new Set(prev);
      next.has(host) ? next.delete(host) : next.add(host);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Scanner</h1>
          <p className="text-sm text-muted-foreground mt-1">TCP port scanning with AI-powered analysis and branded reporting</p>
        </div>

        <Tabs defaultValue="scan" className="space-y-4">
          <TabsList className="bg-muted/30 border border-border">
            <TabsTrigger value="scan">New Scan</TabsTrigger>
            <TabsTrigger value="history">Scan History ({scans.length})</TabsTrigger>
            <TabsTrigger value="schedules">Schedules ({schedules.length})</TabsTrigger>
            {selectedScan && <TabsTrigger value="results">Results</TabsTrigger>}
          </TabsList>

          {/* New Scan Tab */}
          <TabsContent value="scan" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Target Input */}
              <div className="lg:col-span-2 border border-border rounded-lg bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" /> Scan Target
                </h2>
                <div className="flex gap-3">
                  <Select value={targetType} onValueChange={setTargetType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ip">Single IP</SelectItem>
                      <SelectItem value="multiple">Multiple IPs</SelectItem>
                      <SelectItem value="domain">Domain</SelectItem>
                      <SelectItem value="cidr">CIDR Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {targetType === "multiple" ? (
                  <Textarea value={target} onChange={e => setTarget(e.target.value)} placeholder="Enter IPs/domains, one per line&#10;192.168.1.1&#10;example.com&#10;10.0.0.0/24" rows={5} className="font-mono text-sm" />
                ) : (
                  <Input value={target} onChange={e => setTarget(e.target.value)}
                    placeholder={targetType === "domain" ? "example.com" : targetType === "cidr" ? "192.168.1.0/24" : "192.168.1.1"}
                    className="font-mono" />
                )}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Scan Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SCAN_TYPES.map(st => (
                      <button key={st.value} onClick={() => setScanType(st.value)}
                        className={`border rounded-md p-3 text-left transition-colors ${scanType === st.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                        <p className="text-xs font-medium text-foreground">{st.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{st.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="border border-border rounded-lg bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Options
                </h2>
                <div>
                  <Label className="text-xs">Ports (leave empty for default)</Label>
                  <Input value={ports} onChange={e => setPorts(e.target.value)} placeholder="80,443,8080 or 1-1024" className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Timing Template</Label>
                  <Select value={timing} onValueChange={setTiming}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMING_TEMPLATES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Enable script checks</Label>
                  <Switch checked={enableScripts} onCheckedChange={setEnableScripts} />
                </div>
                {scanType === "custom" && (
                  <div>
                    <Label className="text-xs">Custom Options</Label>
                    <Input value={customOptions} onChange={e => setCustomOptions(e.target.value)} className="mt-1 font-mono text-sm" placeholder="Additional flags" />
                  </div>
                )}
                <div className="pt-2 space-y-2">
                  <Button onClick={handleStartScan} disabled={scanning || !target.trim()} className="w-full gap-2">
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {scanning ? "Scanning..." : "Start Scan"}
                  </Button>
                  <Button variant="outline" onClick={() => { setScheduleDialog(true); setSchedName(`Scan ${target}`); }} disabled={!target.trim()} className="w-full gap-2">
                    <Calendar className="h-4 w-4" /> Schedule Scan
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Scan History */}
          <TabsContent value="history" className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : scans.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No scans yet. Run your first scan above.</p>
              </div>
            ) : (
              scans.map(scan => (
                <div key={scan.id} className="border border-border rounded-lg bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground truncate">{scan.target}</span>
                      {statusBadge(scan.status)}
                      <Badge variant="outline" className="text-[10px]">{scan.scan_type}</Badge>
                    </div>
                    <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground">
                      <span>{format(new Date(scan.created_at), "MMM d, yyyy HH:mm")}</span>
                      {scan.result_summary && (
                        <>
                          <span>{scan.result_summary.total_hosts} hosts</span>
                          <span>{scan.result_summary.total_open_ports} open ports</span>
                        </>
                      )}
                      {scan.ai_analysis && <span className="text-primary flex items-center gap-1"><Brain className="h-3 w-3" /> AI analyzed</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleViewResults(scan)} className="gap-1 text-xs h-7">
                      <FileText className="h-3 w-3" /> View
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteScan(scan.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Schedules */}
          <TabsContent value="schedules" className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setScheduleDialog(true)} className="gap-1">
                <Plus className="h-3 w-3" /> New Schedule
              </Button>
            </div>
            {schedules.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No scheduled scans yet.</p>
              </div>
            ) : (
              schedules.map(s => (
                <div key={s.id} className="border border-border rounded-lg bg-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{s.target}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{s.frequency}</Badge>
                      <Badge variant="outline" className="text-[10px]">{s.scan_type}</Badge>
                      {s.auto_ai_analysis && <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Auto AI</Badge>}
                    </div>
                  </div>
                  <Switch checked={s.active} onCheckedChange={v => toggleSchedule(s.id, v)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSchedule(s.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          {/* Results */}
          {selectedScan && (
            <TabsContent value="results" className="space-y-4">
              {/* Summary */}
              <div className="border border-border rounded-lg bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Scan: <span className="font-mono">{selectedScan.target}</span></h2>
                    <p className="text-xs text-muted-foreground">{format(new Date(selectedScan.created_at), "MMM d, yyyy HH:mm:ss")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing || selectedScan.status !== "completed"} className="gap-1">
                      {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                      Analyze with AI
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("html")} disabled={exporting || selectedScan.status !== "completed"} className="gap-1">
                      <Download className="h-3 w-3" /> HTML
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("csv")} disabled={exporting || selectedScan.status !== "completed"} className="gap-1">
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                  </div>
                </div>
                {selectedScan.result_summary && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: "Total Hosts", value: selectedScan.result_summary.total_hosts },
                      { label: "Hosts Up", value: selectedScan.result_summary.hosts_up },
                      { label: "Hosts Down", value: selectedScan.result_summary.hosts_down },
                      { label: "Open Ports", value: selectedScan.result_summary.total_open_ports },
                      { label: "Ports Scanned", value: selectedScan.result_summary.ports_scanned },
                    ].map(m => (
                      <div key={m.label} className="border border-border rounded-md bg-muted/20 p-3 text-center">
                        <p className="text-xl font-bold text-foreground">{m.value}</p>
                        <p className="text-[10px] text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Host Results */}
              <div className="border border-border rounded-lg bg-card">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Host Details</h3>
                </div>
                {loadingResults ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : (
                  <div className="divide-y divide-border">
                    {scanResults.map(result => {
                      const openPorts = (result.ports || []).filter((p: any) => p.state === "open");
                      const isExpanded = expandedHosts.has(result.host);
                      return (
                        <div key={result.id}>
                          <button onClick={() => toggleHost(result.host)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <span className="font-mono text-sm font-semibold text-foreground">{result.host}</span>
                            <Badge variant="outline" className={`text-[10px] ${result.host_status === "up" ? "bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))]" : "bg-muted text-muted-foreground"}`}>
                              {result.host_status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{openPorts.length} open ports</span>
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              {openPorts.length === 0 ? (
                                <p className="text-xs text-muted-foreground pl-7">No open ports detected</p>
                              ) : (
                                <div className="ml-7 border border-border rounded overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-muted/30">
                                        <th className="text-left p-2 font-medium text-muted-foreground">Port</th>
                                        <th className="text-left p-2 font-medium text-muted-foreground">Protocol</th>
                                        <th className="text-left p-2 font-medium text-muted-foreground">Service</th>
                                        <th className="text-left p-2 font-medium text-muted-foreground">Version/Banner</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {openPorts.map((p: any, i: number) => (
                                        <tr key={i} className="hover:bg-muted/10">
                                          <td className="p-2 font-mono font-semibold">{p.port}</td>
                                          <td className="p-2 text-muted-foreground">{p.protocol}</td>
                                          <td className="p-2">{p.service}</td>
                                          <td className="p-2 font-mono text-muted-foreground truncate max-w-xs">{p.version || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              {selectedScan.ai_analysis && (
                <div className="border border-border rounded-lg bg-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">AI Security Analysis</h3>
                    <Badge variant="outline" className={`text-[10px] ${severityColor(selectedScan.ai_analysis.overall_risk_score)}`}>
                      {selectedScan.ai_analysis.overall_risk_score?.toUpperCase()} RISK
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Executive Summary</h4>
                      <p className="text-sm text-foreground">{selectedScan.ai_analysis.executive_summary}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Risk Assessment</h4>
                      <p className="text-sm text-foreground">{selectedScan.ai_analysis.risk_assessment}</p>
                    </div>
                  </div>

                  {selectedScan.ai_analysis.technical_findings?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Technical Findings</h4>
                      <div className="space-y-2">
                        {selectedScan.ai_analysis.technical_findings.map((f: any, i: number) => (
                          <div key={i} className={`border rounded-md p-3 ${severityColor(f.severity)}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-[10px] ${severityColor(f.severity)}`}>{f.severity}</Badge>
                              <span className="text-xs font-medium">{f.finding}</span>
                            </div>
                            <p className="text-xs opacity-80">{f.details}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedScan.ai_analysis.remediation_recommendations?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Remediation Recommendations</h4>
                      <div className="space-y-2">
                        {selectedScan.ai_analysis.remediation_recommendations.map((r: any, i: number) => (
                          <div key={i} className="border border-border rounded-md p-3 bg-muted/10">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-[10px] ${r.priority === "immediate" ? "bg-destructive/10 text-destructive border-destructive/30" : r.priority === "short-term" ? "bg-[hsl(var(--severity-high))]/10 text-[hsl(var(--severity-high))]" : "bg-primary/10 text-primary"}`}>
                                {r.priority}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                            </div>
                            <p className="text-xs text-foreground">{r.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedScan.ai_analysis.firewall_rules?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Firewall Hardening</h4>
                      <ul className="text-xs space-y-1 text-foreground list-disc pl-4">
                        {selectedScan.ai_analysis.firewall_rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}

                  {selectedScan.ai_analysis.patch_recommendations?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Patch Recommendations</h4>
                      <ul className="text-xs space-y-1 text-foreground list-disc pl-4">
                        {selectedScan.ai_analysis.patch_recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Schedule Dialog */}
        <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Schedule Recurring Scan</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Schedule Name</Label><Input value={schedName} onChange={e => setSchedName(e.target.value)} className="mt-1" /></div>
              <div>
                <Label>Frequency</Label>
                <Select value={schedFreq} onValueChange={setSchedFreq}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom Cron</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {schedFreq === "custom" && (
                <div><Label>Cron Expression</Label><Input value={schedCron} onChange={e => setSchedCron(e.target.value)} className="mt-1 font-mono" placeholder="0 2 * * *" /></div>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Email notification on completion</Label>
                  <Switch checked={schedNotify} onCheckedChange={setSchedNotify} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Auto-create ticket if critical vuln found</Label>
                  <Switch checked={schedAutoTicket} onCheckedChange={setSchedAutoTicket} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Auto-run AI analysis</Label>
                  <Switch checked={schedAutoAI} onCheckedChange={setSchedAutoAI} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialog(false)}>Cancel</Button>
              <Button onClick={handleAddSchedule}>Create Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
