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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Play, Brain, Download, Trash2, Clock, Shield, Server,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, FileText,
  Calendar, Plus, ToggleLeft, Globe, Wifi, Activity, Radar,
  Monitor, Lock, Unlock, Eye, Zap, BarChart3, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useScans, useScanSchedules, type Scan, type ScanResult } from "@/hooks/useScans";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { generatePDFReport, type ReportBranding } from "@/lib/pdfReportGenerator";
import { AICommandGenerator } from "@/components/AICommandGenerator";

const SCAN_TYPES = [
  { value: "quick", label: "Quick Scan", desc: "Top 20 common ports", icon: Zap },
  { value: "full", label: "Full Port Scan", desc: "Extended port range (~40 ports)", icon: Radar },
  { value: "service", label: "Service Detection", desc: "Identify running services", icon: Monitor },
  { value: "vuln", label: "Vulnerability Scan", desc: "NSE-style checks", icon: Shield },
  { value: "custom", label: "Custom Scan", desc: "Advanced options", icon: Activity },
  { value: "raw", label: "Raw Command", desc: "Enter full nmap command", icon: FileText },
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
    case "running": return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Running
      </Badge>
    );
    case "completed": return (
      <Badge variant="outline" className="bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))] border-[hsl(var(--severity-low))]/30 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    );
    case "failed": return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Failed
      </Badge>
    );
    case "cancelled": return <Badge variant="outline" className="bg-muted text-muted-foreground">Cancelled</Badge>;
    default: return (
      <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  }
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent?: string }) {
  return (
    <div className="relative overflow-hidden border border-border rounded-xl bg-card p-4 group hover:border-primary/30 transition-all duration-200">
      <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <Icon className="w-full h-full" />
      </div>
      <p className={`text-2xl font-bold tracking-tight ${accent || "text-foreground"}`}>{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default function NetworkScanner() {
  const { scans, loading, startScan, analyzeScan, getScanResults, deleteScan } = useScans();
  const { schedules, addSchedule, toggleSchedule, deleteSchedule } = useScanSchedules();
  const { general } = useSettings();
  const { toast } = useToast();

  const [target, setTarget] = useState("");
  const [targetType, setTargetType] = useState("ip");
  const [scanType, setScanType] = useState("quick");
  const [ports, setPorts] = useState("");
  const [timing, setTiming] = useState("T3");
  const [enableScripts, setEnableScripts] = useState(false);
  const [customOptions, setCustomOptions] = useState("");
  const [rawCommand, setRawCommand] = useState("nmap -sV -O ");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ percent: number; phase: string } | null>(null);

  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedFreq, setSchedFreq] = useState("once");
  const [schedCron, setSchedCron] = useState("");
  const [schedNotify, setSchedNotify] = useState(false);
  const [schedAutoTicket, setSchedAutoTicket] = useState(false);
  const [schedAutoAI, setSchedAutoAI] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("scan");
  const [aiCommandOpen, setAiCommandOpen] = useState(false);

  const handleStartScan = async () => {
    if (scanType === "raw") {
      if (!rawCommand.trim()) return;
    } else {
      if (!target.trim()) return;
    }
    setScanning(true);
    setScanProgress(null);
    try {
      const scan = await startScan({
        target: scanType === "raw" ? rawCommand.trim() : target,
        target_type: scanType === "raw" ? "raw_command" : targetType,
        scan_type: scanType,
        ports,
        timing_template: timing,
        enable_scripts: enableScripts,
        custom_options: scanType === "raw" ? rawCommand.trim() : customOptions,
      });
      toast({ title: "Scan Started", description: "Port scan is now running" });

      // Start polling progress for local scans
      if (scan) {
        const scanId = (scan as any).id;
        pollProgress(scanId);
      }
    } catch (e: any) {
      toast({ title: "Scan Failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const pollProgress = (scanId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.from("scans").select("status").eq("id", scanId).single();
        if (data && (data as any).status === "completed" || (data as any).status === "failed") {
          setScanProgress(null);
          clearInterval(interval);
          return;
        }
        // Try to get progress from local server
        try {
          const settings = await supabase.from("app_settings").select("value").eq("key", "integrations").single();
          const val = settings.data?.value as any;
          if (val?.nmapBackend?.mode === "local") {
            const baseUrl = (val.nmapBackend.localUrl || "http://localhost:3001").replace(/\/$/, "");
            const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
            if (val.nmapBackend.apiKey) headers["x-api-key"] = val.nmapBackend.apiKey;
            const resp = await fetch(`${baseUrl}/api/scan/${scanId}/progress`, { headers });
            if (resp.ok) {
              const progress = await resp.json();
              setScanProgress({ percent: progress.percent || 0, phase: progress.phase || "Scanning..." });
            }
          }
        } catch {}
      } catch {
        clearInterval(interval);
      }
    }, 2000);
    // Auto-stop after 10 minutes
    setTimeout(() => { clearInterval(interval); setScanProgress(null); }, 600000);
  };

  const handleViewResults = async (scan: Scan) => {
    setSelectedScan(scan);
    setLoadingResults(true);
    setExpandedHosts(new Set());
    const results = await getScanResults(scan.id);
    setScanResults(results);
    setLoadingResults(false);
    setActiveTab("results");
  };

  const handleAnalyze = async () => {
    if (!selectedScan) return;
    setAnalyzing(true);
    try {
      await analyzeScan(selectedScan.id);
      const { data } = await supabase.from("scans").select("*").eq("id", selectedScan.id).single();
      if (data) setSelectedScan(data as unknown as Scan);
      toast({ title: "Analysis Complete", description: "AI security analysis is ready" });
    } catch (e: any) {
      toast({ title: "Analysis Failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const loadReportBranding = async (): Promise<Partial<ReportBranding>> => {
    try {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "report_customization").single();
      if (data?.value) return data.value as any;
    } catch {}
    return { orgName: "ThreatIntel", footerText: "Confidential — for authorized personnel only.", logoUrl: general.logoUrl || "" };
  };

  const handleExport = async (fmt: "html" | "csv" | "pdf") => {
    if (!selectedScan) return;
    setExporting(true);
    try {
      if (fmt === "pdf") {
        const results = scanResults.length > 0 ? scanResults : await getScanResults(selectedScan.id);
        const branding = await loadReportBranding();
        await generatePDFReport(selectedScan, results, branding);
        await supabase.from("generated_reports").insert({
          scan_id: selectedScan.id,
          name: `Scan Report — ${selectedScan.target}`,
          format: "pdf",
          scan_target: selectedScan.target,
          scan_type: selectedScan.scan_type,
        } as any);
        toast({ title: "PDF Report Downloaded" });
      } else {
        const branding = await loadReportBranding();
        const { data, error } = await supabase.functions.invoke("generate-scan-report", {
          body: {
            scanId: selectedScan.id,
            format: fmt,
            branding: {
              logoUrl: branding.logoUrl || general.logoUrl || "",
              orgName: branding.orgName || "ThreatIntel",
              disclaimer: branding.footerText || "Confidential — for authorized personnel only.",
              primaryColor: branding.primaryColor,
            },
          },
        });
        if (error) throw new Error(error.message);
        const reportContent = typeof data === "string" ? data : JSON.stringify(data);
        await supabase.from("generated_reports").insert({
          scan_id: selectedScan.id,
          name: `Scan Report — ${selectedScan.target}`,
          format: fmt,
          report_html: reportContent,
          scan_target: selectedScan.target,
          scan_type: selectedScan.scan_type,
        } as any);
        const blob = new Blob([data], { type: fmt === "csv" ? "text/csv" : "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scan-report-${selectedScan.id.slice(0, 8)}.${fmt}`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Report Downloaded & Saved" });
      }
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

  const runningScans = scans.filter(s => s.status === "running").length;
  const completedScans = scans.filter(s => s.status === "completed").length;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Radar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Network Scanner</h1>
                <p className="text-xs text-muted-foreground">Real-time port scanning with AI-powered security analysis</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {runningScans > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">{runningScans} scan{runningScans > 1 ? "s" : ""} active</span>
              </div>
            )}
            <Badge variant="outline" className="text-xs gap-1.5 py-1">
              <BarChart3 className="h-3 w-3" />
              {scans.length} total scans
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="bg-muted/40 border border-border p-1 h-auto">
            <TabsTrigger value="scan" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Play className="h-3.5 w-3.5" /> New Scan
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Clock className="h-3.5 w-3.5" /> History
              {scans.length > 0 && <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{scans.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Calendar className="h-3.5 w-3.5" /> Schedules
              {schedules.length > 0 && <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{schedules.length}</span>}
            </TabsTrigger>
            {selectedScan && (
              <TabsTrigger value="results" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Eye className="h-3.5 w-3.5" /> Results
              </TabsTrigger>
            )}
          </TabsList>

          {/* ─── NEW SCAN ─── */}
          <TabsContent value="scan" className="space-y-5">
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Target & Scan Type */}
              <div className="lg:col-span-2 border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" /> Scan Target
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Define the hosts, domains, or IP ranges to scan</p>
                </div>
                <div className="p-5 space-y-5">
                  {scanType === "raw" ? (
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Full Nmap Command</Label>
                      <Textarea
                        value={rawCommand}
                        onChange={e => setRawCommand(e.target.value)}
                        placeholder="nmap -sV -O -T4 --script=vuln 192.168.1.0/24"
                        rows={4}
                        className="font-mono text-sm bg-muted/20"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Enter the complete nmap command. The target is extracted automatically. Example: <code className="bg-muted px-1 rounded">nmap -sS -sV -O -T4 192.168.1.1</code>
                      </p>
                      <div className="mt-3 p-3 rounded-lg bg-[hsl(var(--severity-medium))]/5 border border-[hsl(var(--severity-medium))]/20">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--severity-medium))] shrink-0 mt-0.5" />
                          <p className="text-[10px] text-[hsl(var(--severity-medium))]">Raw commands run as-is on the server. Ensure you have authorization to scan the target. The <code className="bg-muted px-1 rounded">-oX -</code> flag is appended automatically for XML output.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <Select value={targetType} onValueChange={setTargetType}>
                          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ip">Single IP</SelectItem>
                            <SelectItem value="multiple">Multiple IPs</SelectItem>
                            <SelectItem value="domain">Domain</SelectItem>
                            <SelectItem value="cidr">CIDR Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {targetType === "multiple" ? (
                        <Textarea value={target} onChange={e => setTarget(e.target.value)} placeholder="Enter IPs/domains, one per line&#10;192.168.1.1&#10;example.com&#10;10.0.0.0/24" rows={4} className="font-mono text-sm bg-muted/20" />
                      ) : (
                        <Input value={target} onChange={e => setTarget(e.target.value)}
                          placeholder={targetType === "domain" ? "example.com" : targetType === "cidr" ? "192.168.1.0/24" : "192.168.1.1"}
                          className="font-mono bg-muted/20" />
                      )}
                    </>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-3 block uppercase tracking-wider font-semibold">Scan Profile</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                      {SCAN_TYPES.map(st => {
                        const Icon = st.icon;
                        const selected = scanType === st.value;
                        return (
                          <button key={st.value} onClick={() => setScanType(st.value)}
                            className={`relative border rounded-xl p-3.5 text-left transition-all duration-200 group ${selected ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}>
                            <div className="flex items-start gap-2.5">
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"}`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className={`text-xs font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{st.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{st.desc}</p>
                              </div>
                            </div>
                            {selected && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Options Panel */}
              <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-border bg-muted/20">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> {scanType === "raw" ? "Raw Command Mode" : "Scan Options"}
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {scanType === "raw" ? "Command will be sent directly to the Nmap server" : "Fine-tune scanning parameters"}
                  </p>
                </div>
                <div className="p-5 space-y-4 flex-1">
                  {scanType === "raw" ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted/20 border border-border">
                        <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Command Preview</p>
                        <p className="text-xs font-mono text-foreground break-all">{rawCommand || "nmap ..."}</p>
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-1">
                        <p className="font-semibold">Tips:</p>
                        <p>• Include target IP/domain in the command</p>
                        <p>• <code className="bg-muted px-1 rounded">-oX -</code> is auto-appended for parsing</p>
                        <p>• Use <code className="bg-muted px-1 rounded">sudo</code> flags like <code className="bg-muted px-1 rounded">-sS</code> require root on the server</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs font-medium">Port Range</Label>
                        <Input value={ports} onChange={e => setPorts(e.target.value)} placeholder="80,443,8080 or 1-1024" className="mt-1.5 font-mono text-sm bg-muted/20" />
                        <p className="text-[10px] text-muted-foreground mt-1">Leave empty for default ports</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Timing Template</Label>
                        <Select value={timing} onValueChange={setTiming}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIMING_TEMPLATES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border">
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label className="text-xs cursor-pointer">NSE Script Checks</Label>
                        </div>
                        <Switch checked={enableScripts} onCheckedChange={setEnableScripts} />
                      </div>
                      {scanType === "custom" && (
                        <div>
                          <Label className="text-xs font-medium">Custom Flags</Label>
                          <Input value={customOptions} onChange={e => setCustomOptions(e.target.value)} className="mt-1.5 font-mono text-sm bg-muted/20" placeholder="--script=vuln -Pn" />
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="p-5 pt-0 space-y-2.5">
                  {/* Progress Bar */}
                  {scanProgress && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground font-medium">{scanProgress.phase}</span>
                        <span className="text-primary font-bold">{scanProgress.percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                          style={{ width: `${scanProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleStartScan}
                    disabled={scanning || (scanType === "raw" ? !rawCommand.trim() : !target.trim())}
                    className="w-full gap-2 h-10 font-semibold"
                  >
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {scanning ? (scanProgress ? `Scanning ${scanProgress.percent}%...` : "Scanning...") : "Launch Scan"}
                  </Button>
                  <Button variant="outline" onClick={() => setAiCommandOpen(true)} className="w-full gap-2 h-9 text-xs border-primary/30 text-primary hover:bg-primary/5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Command Assistant
                  </Button>
                  <Button variant="outline" onClick={() => { setScheduleDialog(true); setSchedName(`Scan ${target}`); }} disabled={scanType === "raw" || !target.trim()} className="w-full gap-2 h-9 text-xs">
                    <Calendar className="h-3.5 w-3.5" /> Schedule Recurring
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── SCAN HISTORY ─── */}
          <TabsContent value="history" className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading scan history...</p>
              </div>
            ) : scans.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Radar className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No scans yet</p>
                <p className="text-xs text-muted-foreground">Start your first network scan to see results here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scans.map(scan => (
                  <div key={scan.id} className="group border border-border rounded-xl bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200 cursor-pointer" onClick={() => handleViewResults(scan)}>
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        scan.status === "running" ? "bg-primary/10 text-primary" :
                        scan.status === "completed" ? "bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))]" :
                        scan.status === "failed" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {scan.status === "running" ? <Loader2 className="h-5 w-5 animate-spin" /> :
                         scan.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> :
                         scan.status === "failed" ? <AlertTriangle className="h-5 w-5" /> :
                         <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-foreground">{scan.target}</span>
                          {statusBadge(scan.status)}
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{scan.scan_type}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(scan.created_at), "MMM d, yyyy HH:mm")}
                          </span>
                          {scan.result_summary && (
                            <>
                              <span className="flex items-center gap-1"><Server className="h-3 w-3" />{scan.result_summary.total_hosts} hosts</span>
                              <span className="flex items-center gap-1">
                                {scan.result_summary.total_open_ports > 0 ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                {scan.result_summary.total_open_ports} open ports
                              </span>
                            </>
                          )}
                          {scan.ai_analysis && <span className="text-primary flex items-center gap-1 font-medium"><Brain className="h-3 w-3" /> AI analyzed</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); handleViewResults(scan); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Results</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={e => { e.stopPropagation(); deleteScan(scan.id); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Scan</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── SCHEDULES ─── */}
          <TabsContent value="schedules" className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setScheduleDialog(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Schedule
              </Button>
            </div>
            {schedules.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No schedules</p>
                <p className="text-xs text-muted-foreground">Set up recurring scans to automate security monitoring</p>
              </div>
            ) : (
              schedules.map(s => (
                <div key={s.id} className="border border-border rounded-xl bg-card p-4 flex items-center gap-4 hover:border-primary/20 transition-colors">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${s.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{s.name}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{s.target}</p>
                    <div className="flex gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{s.frequency}</Badge>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{s.scan_type}</Badge>
                      {s.auto_ai_analysis && <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5">Auto AI</Badge>}
                    </div>
                  </div>
                  <Switch checked={s.active} onCheckedChange={v => toggleSchedule(s.id, v)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={() => deleteSchedule(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          {/* ─── RESULTS ─── */}
          {selectedScan && (
            <TabsContent value="results" className="space-y-5">
              {/* Summary Header */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">Scan Results</h2>
                      {statusBadge(selectedScan.status)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-primary">{selectedScan.target}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">{format(new Date(selectedScan.created_at), "MMM d, yyyy HH:mm:ss")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing || selectedScan.status !== "completed"} className="gap-1.5 h-8 text-xs">
                      {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                      AI Analysis
                    </Button>
                    <div className="h-5 w-px bg-border" />
                    <Button variant="ghost" size="sm" onClick={() => handleExport("pdf")} disabled={exporting || selectedScan.status !== "completed"} className="gap-1 h-8 text-xs">
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExport("html")} disabled={exporting || selectedScan.status !== "completed"} className="gap-1 h-8 text-xs">
                      <Download className="h-3 w-3" /> HTML
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExport("csv")} disabled={exporting || selectedScan.status !== "completed"} className="gap-1 h-8 text-xs">
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                  </div>
                </div>
                {selectedScan.result_summary && (
                  <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard label="Total Hosts" value={selectedScan.result_summary.total_hosts} icon={Server} />
                    <StatCard label="Hosts Up" value={selectedScan.result_summary.hosts_up} icon={Wifi} accent="text-[hsl(var(--severity-low))]" />
                    <StatCard label="Hosts Down" value={selectedScan.result_summary.hosts_down} icon={AlertTriangle} accent="text-muted-foreground" />
                    <StatCard label="Open Ports" value={selectedScan.result_summary.total_open_ports} icon={Unlock} accent="text-[hsl(var(--severity-high))]" />
                    <StatCard label="Ports Scanned" value={selectedScan.result_summary.ports_scanned} icon={Activity} />
                  </div>
                )}
              </div>

              {/* Host Results */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" /> Host Details
                  </h3>
                  <Badge variant="outline" className="text-[10px]">{scanResults.length} host{scanResults.length !== 1 ? "s" : ""}</Badge>
                </div>
                {loadingResults ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Loading results...</p>
                  </div>
                ) : scanResults.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p className="text-xs">No host results found for this scan</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {scanResults.map(result => {
                      const openPorts = (result.ports || []).filter((p: any) => p.state === "open");
                      const isExpanded = expandedHosts.has(result.host);
                      return (
                        <div key={result.id}>
                          <button onClick={() => toggleHost(result.host)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left group">
                            <div className={`h-5 w-5 rounded flex items-center justify-center transition-colors ${isExpanded ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${result.host_status === "up" ? "bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))]" : "bg-muted text-muted-foreground"}`}>
                              <Monitor className="h-4 w-4" />
                            </div>
                            <span className="font-mono text-sm font-semibold text-foreground">{result.host}</span>
                            <Badge variant="outline" className={`text-[10px] ${result.host_status === "up" ? "bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))] border-[hsl(var(--severity-low))]/30" : "bg-muted text-muted-foreground"}`}>
                              {result.host_status}
                            </Badge>
                            {result.os_detection && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{result.os_detection}</span>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground font-medium">{openPorts.length} open port{openPorts.length !== 1 ? "s" : ""}</span>
                          </button>
                          {isExpanded && (
                            <div className="px-5 pb-4">
                              {openPorts.length === 0 ? (
                                <p className="text-xs text-muted-foreground pl-14">No open ports detected</p>
                              ) : (
                                <div className="ml-14 border border-border rounded-lg overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-muted/30 border-b border-border">
                                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Port</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Protocol</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Service</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Version / Banner</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {openPorts.map((p: any, i: number) => (
                                        <tr key={i} className="hover:bg-muted/10 transition-colors">
                                          <td className="px-4 py-2.5 font-mono font-bold text-foreground">{p.port}</td>
                                          <td className="px-4 py-2.5 text-muted-foreground uppercase">{p.protocol}</td>
                                          <td className="px-4 py-2.5 font-medium">{p.service}</td>
                                          <td className="px-4 py-2.5 font-mono text-muted-foreground truncate max-w-xs">{p.version || "—"}</td>
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
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Brain className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">AI Security Analysis</h3>
                      <p className="text-[10px] text-muted-foreground">Powered by AI threat intelligence</p>
                    </div>
                    <Badge variant="outline" className={`ml-auto text-[10px] ${severityColor(selectedScan.ai_analysis.overall_risk_score)}`}>
                      {selectedScan.ai_analysis.overall_risk_score?.toUpperCase()} RISK
                    </Badge>
                  </div>

                  <div className="p-5 space-y-5">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border bg-muted/10 p-4">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</h4>
                        <p className="text-sm text-foreground leading-relaxed">{selectedScan.ai_analysis.executive_summary}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/10 p-4">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risk Assessment</h4>
                        <p className="text-sm text-foreground leading-relaxed">{selectedScan.ai_analysis.risk_assessment}</p>
                      </div>
                    </div>

                    {selectedScan.ai_analysis.technical_findings?.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Technical Findings</h4>
                        <div className="space-y-2">
                          {selectedScan.ai_analysis.technical_findings.map((f: any, i: number) => (
                            <div key={i} className={`border rounded-lg p-3.5 ${severityColor(f.severity)}`}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <Badge variant="outline" className={`text-[10px] ${severityColor(f.severity)}`}>{f.severity?.toUpperCase()}</Badge>
                                <span className="text-xs font-semibold">{f.finding}</span>
                              </div>
                              <p className="text-xs opacity-80 leading-relaxed">{f.details}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedScan.ai_analysis.remediation_recommendations?.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Remediation Recommendations</h4>
                        <div className="space-y-2">
                          {selectedScan.ai_analysis.remediation_recommendations.map((r: any, i: number) => (
                            <div key={i} className="border border-border rounded-lg p-3.5 bg-muted/10 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Badge variant="outline" className={`text-[10px] ${r.priority === "immediate" ? "bg-destructive/10 text-destructive border-destructive/30" : r.priority === "short-term" ? "bg-[hsl(var(--severity-high))]/10 text-[hsl(var(--severity-high))]" : "bg-primary/10 text-primary"}`}>
                                  {r.priority}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                              </div>
                              <p className="text-xs text-foreground leading-relaxed">{r.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedScan.ai_analysis.firewall_rules?.length > 0 && (
                      <div className="rounded-lg border border-border bg-muted/10 p-4">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Firewall Hardening Rules</h4>
                        <ul className="text-xs space-y-1.5 text-foreground">
                          {selectedScan.ai_analysis.firewall_rules.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <Shield className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedScan.ai_analysis.patch_recommendations?.length > 0 && (
                      <div className="rounded-lg border border-border bg-muted/10 p-4">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Patch Recommendations</h4>
                        <ul className="text-xs space-y-1.5 text-foreground">
                          {selectedScan.ai_analysis.patch_recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 text-[hsl(var(--severity-low))] shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Schedule Dialog */}
        <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Schedule Recurring Scan
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium">Schedule Name</Label>
                <Input value={schedName} onChange={e => setSchedName(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs font-medium">Frequency</Label>
                <Select value={schedFreq} onValueChange={setSchedFreq}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
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
                <div>
                  <Label className="text-xs font-medium">Cron Expression</Label>
                  <Input value={schedCron} onChange={e => setSchedCron(e.target.value)} className="mt-1.5 font-mono" placeholder="0 2 * * *" />
                </div>
              )}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border">
                  <Label className="text-xs cursor-pointer">Email on completion</Label>
                  <Switch checked={schedNotify} onCheckedChange={setSchedNotify} />
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border">
                  <Label className="text-xs cursor-pointer">Auto-create ticket for critical vulns</Label>
                  <Switch checked={schedAutoTicket} onCheckedChange={setSchedAutoTicket} />
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border">
                  <Label className="text-xs cursor-pointer">Auto-run AI analysis</Label>
                  <Switch checked={schedAutoAI} onCheckedChange={setSchedAutoAI} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialog(false)}>Cancel</Button>
              <Button onClick={handleAddSchedule} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
