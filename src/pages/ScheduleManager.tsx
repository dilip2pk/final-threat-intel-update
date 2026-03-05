import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar, Clock, Plus, Trash2, Play, Loader2, CheckCircle2, XCircle,
  Radar, Crosshair, FileText, ToggleLeft, AlertTriangle, Edit, Download, Eye, Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useScheduledJobs, type ScheduledJob } from "@/hooks/useScheduledJobs";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const JOB_TYPES = [
  { value: "shodan_scan", label: "Shodan Scan", icon: Radar, desc: "Run Shodan search queries automatically" },
  { value: "network_scan", label: "Network Scan", icon: Crosshair, desc: "Automated port scanning" },
];

const FREQUENCIES = [
  { value: "once", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom (Cron)" },
];

function statusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge variant="outline" className="text-[10px] bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))] border-[hsl(var(--severity-low))]/30">Completed</Badge>;
    case "running": return <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 animate-pulse">Running</Badge>;
    case "failed": return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Failed</Badge>;
    default: return <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Pending</Badge>;
  }
}

function jobTypeIcon(type: string) {
  const jt = JOB_TYPES.find(j => j.value === type);
  if (!jt) return <Calendar className="h-4 w-4" />;
  const Icon = jt.icon;
  return <Icon className="h-4 w-4" />;
}

export default function ScheduleManager() {
  const { jobs, loading, addJob, deleteJob, toggleJob, runJobNow, updateJob } = useScheduledJobs();
  const { isAdmin, role, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Form state
  const [jobName, setJobName] = useState("");
  const [jobType, setJobType] = useState("shodan_scan");
  const [frequency, setFrequency] = useState("once");
  const [cronExpression, setCronExpression] = useState("");
  
  // Shodan config
  const [shodanQuery, setShodanQuery] = useState("");
  const [shodanQueryType, setShodanQueryType] = useState("search");
  
  // Network scan config
  const [scanTarget, setScanTarget] = useState("");
  const [scanTargetType, setScanTargetType] = useState("ip");
  const [scanType, setScanType] = useState("quick");
  const [scanPorts, setScanPorts] = useState("");
  
  // Report config
  const [reportScanId, setReportScanId] = useState("");
  const [reportFormat, setReportFormat] = useState("html");

  // Fetch available scans and reports
  useEffect(() => {
    const fetchScans = async () => {
      const { data } = await supabase
        .from("scans")
        .select("id, target, scan_type, status, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setAvailableScans(data as ScanOption[]);
    };
    const fetchReports = async () => {
      const { data } = await supabase
        .from("generated_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setReports(data as unknown as GeneratedReport[]);
      setReportsLoading(false);
    };
    fetchScans();
    fetchReports();
  }, []);

  const resetForm = () => {
    setJobName(""); setJobType("shodan_scan"); setFrequency("once");
    setCronExpression(""); setShodanQuery(""); setShodanQueryType("search");
    setScanTarget(""); setScanTargetType("ip"); setScanType("quick");
    setScanPorts(""); setReportScanId(""); setReportFormat("pdf");
    setEditingJob(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (job: ScheduledJob) => {
    setEditingJob(job);
    setJobName(job.name);
    setJobType(job.job_type);
    setFrequency(job.frequency);
    setCronExpression(job.cron_expression || "");
    const config = job.configuration || {};
    if (job.job_type === "shodan_scan") {
      setShodanQuery(config.query || "");
      setShodanQueryType(config.queryType || "search");
    } else if (job.job_type === "network_scan") {
      setScanTarget(config.target || "");
      setScanTargetType(config.targetType || "ip");
      setScanType(config.scanType || "quick");
      setScanPorts(config.ports || "");
    } else if (job.job_type === "report_generation") {
      setReportScanId(config.scanId || "");
      setReportFormat(config.format || "pdf");
    }
    setDialogOpen(true);
  };

  const buildConfig = () => {
    if (jobType === "shodan_scan") return { query: shodanQuery, queryType: shodanQueryType };
    if (jobType === "network_scan") return { target: scanTarget, targetType: scanTargetType, scanType, ports: scanPorts };
    if (jobType === "report_generation") return { scanId: reportScanId, format: reportFormat };
    return {};
  };

  const handleSave = async () => {
    if (!jobName.trim()) return;
    try {
      const jobData = {
        name: jobName,
        job_type: jobType,
        frequency,
        cron_expression: cronExpression,
        configuration: buildConfig(),
        active: true,
      };
      if (editingJob) {
        await updateJob(editingJob.id, jobData);
        toast({ title: "Schedule Updated" });
      } else {
        await addJob(jobData);
        toast({ title: "Schedule Created" });
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRunNow = async (job: ScheduledJob) => {
    setRunningJobId(job.id);
    try {
      const result = await runJobNow(job);
      
      // If report generation, save to generated_reports table
      if (job.job_type === "report_generation" && result) {
        const config = job.configuration as any;
        const scanId = config?.scanId;
        const scan = availableScans.find(s => s.id === scanId);
        await supabase.from("generated_reports").insert({
          scan_id: scanId || null,
          name: job.name,
          format: config?.format || "html",
          report_html: typeof result === "string" ? result : null,
          scan_target: scan?.target || null,
          scan_type: scan?.scan_type || null,
        } as any);
        // Refresh reports list
        const { data } = await supabase.from("generated_reports").select("*").order("created_at", { ascending: false });
        if (data) setReports(data as unknown as GeneratedReport[]);
      }
      
      toast({ title: "Job Executed", description: `${job.name} completed successfully` });
    } catch (e: any) {
      toast({ title: "Job Failed", description: e.message, variant: "destructive" });
    } finally {
      setRunningJobId(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    await supabase.from("generated_reports").delete().eq("id", reportId);
    setReports(prev => prev.filter(r => r.id !== reportId));
    toast({ title: "Report Deleted" });
  };

  const handleDownloadReport = (report: GeneratedReport) => {
    if (!report.report_html) return;
    const blob = new Blob([report.report_html], { type: report.format === "csv" ? "text/csv" : "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, "-")}.${report.format === "csv" ? "csv" : "html"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading schedules...</span>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Schedule management is restricted to Admin users. Your current role: <Badge variant="secondary">{role || "user"}</Badge>
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schedule Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">Automate Shodan scans, network scans, and report generation</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Schedule
          </Button>
        </div>

        {/* Job Type Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {JOB_TYPES.map(jt => {
            const Icon = jt.icon;
            const count = jobs.filter(j => j.job_type === jt.value).length;
            const active = jobs.filter(j => j.job_type === jt.value && j.active).length;
            return (
              <div key={jt.value} className="border border-border rounded-lg bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{jt.label}</p>
                    <p className="text-xs text-muted-foreground">{count} total, {active} active</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Jobs List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Scheduled Jobs ({jobs.length})</h2>
          {jobs.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No scheduled jobs yet. Create your first schedule above.</p>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="border border-border rounded-lg bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                <div className="p-2 rounded-md bg-muted/30">
                  {jobTypeIcon(job.job_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{job.name}</span>
                    {statusBadge(job.last_status)}
                    <Badge variant="outline" className="text-[10px]">{job.frequency}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {JOB_TYPES.find(j => j.value === job.job_type)?.label || job.job_type}
                    </Badge>
                  </div>
                  <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground">
                    {job.last_run_at && <span>Last run: {format(new Date(job.last_run_at), "MMM d, HH:mm")}</span>}
                    {job.cron_expression && <span className="font-mono">Cron: {job.cron_expression}</span>}
                    {job.last_error && (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {job.last_error.substring(0, 50)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleRunNow(job)}
                    disabled={runningJobId === job.id}
                    className="gap-1 text-xs h-7"
                  >
                    {runningJobId === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Run Now
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(job)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Switch checked={job.active} onCheckedChange={v => toggleJob(job.id, v)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { deleteJob(job.id); toast({ title: "Schedule Deleted" }); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingJob ? "Edit Schedule" : "Create New Schedule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div>
                <Label>Schedule Name</Label>
                <Input value={jobName} onChange={e => setJobName(e.target.value)} className="mt-1" placeholder="My daily scan" />
              </div>

              <div>
                <Label>Job Type</Label>
                <Select value={jobType} onValueChange={setJobType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map(jt => (
                      <SelectItem key={jt.value} value={jt.value}>{jt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {frequency === "custom" && (
                <div>
                  <Label>Cron Expression</Label>
                  <Input value={cronExpression} onChange={e => setCronExpression(e.target.value)} className="mt-1 font-mono" placeholder="0 2 * * *" />
                  <p className="text-xs text-muted-foreground mt-1">e.g., "0 2 * * *" = daily at 2am</p>
                </div>
              )}

              {/* Shodan Config */}
              {jobType === "shodan_scan" && (
                <div className="border border-border rounded-md p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Radar className="h-3 w-3 text-primary" /> Shodan Configuration
                  </h3>
                  <div>
                    <Label className="text-xs">Search Query</Label>
                    <Input value={shodanQuery} onChange={e => setShodanQuery(e.target.value)} className="mt-1 font-mono text-sm" placeholder='port:3389 "Remote Desktop"' />
                  </div>
                  <div>
                    <Label className="text-xs">Query Type</Label>
                    <Select value={shodanQueryType} onValueChange={setShodanQueryType}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="search">Search</SelectItem>
                        <SelectItem value="host">Host/IP</SelectItem>
                        <SelectItem value="domain">Domain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Network Scan Config */}
              {jobType === "network_scan" && (
                <div className="border border-border rounded-md p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Crosshair className="h-3 w-3 text-primary" /> Network Scan Configuration
                  </h3>
                  <div>
                    <Label className="text-xs">Target</Label>
                    <Input value={scanTarget} onChange={e => setScanTarget(e.target.value)} className="mt-1 font-mono text-sm" placeholder="192.168.1.1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Target Type</Label>
                      <Select value={scanTargetType} onValueChange={setScanTargetType}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ip">Single IP</SelectItem>
                          <SelectItem value="domain">Domain</SelectItem>
                          <SelectItem value="cidr">CIDR Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Scan Type</Label>
                      <Select value={scanType} onValueChange={setScanType}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick">Quick</SelectItem>
                          <SelectItem value="full">Full</SelectItem>
                          <SelectItem value="service">Service Detection</SelectItem>
                          <SelectItem value="vuln">Vulnerability</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Ports (optional)</Label>
                    <Input value={scanPorts} onChange={e => setScanPorts(e.target.value)} className="mt-1 font-mono text-sm" placeholder="80,443,8080" />
                  </div>
                </div>
              )}

              {/* Report Config */}
              {jobType === "report_generation" && (
                <div className="border border-border rounded-md p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-3 w-3 text-primary" /> Report Configuration
                  </h3>
                  <div>
                    <Label className="text-xs">Select Scan</Label>
                    <Select value={reportScanId} onValueChange={setReportScanId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a completed scan..." /></SelectTrigger>
                      <SelectContent>
                        {availableScans.map(scan => (
                          <SelectItem key={scan.id} value={scan.id}>
                            {scan.target} — {scan.scan_type} ({format(new Date(scan.created_at), "MMM d, HH:mm")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableScans.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">No completed scans found. Run a network scan first.</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Format</Label>
                    <Select value={reportFormat} onValueChange={setReportFormat}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={!jobName.trim()}>
                {editingJob ? "Update Schedule" : "Create Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Generated Reports Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Generated Reports ({reports.length})
          </h2>
          {reportsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reports generated yet. Create a Report Generation schedule and run it.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {reports.map(report => (
                <div key={report.id} className="border border-border rounded-lg bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                  <div className="p-2 rounded-md bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{report.name}</span>
                      <Badge variant="outline" className="text-[10px]">{report.format.toUpperCase()}</Badge>
                    </div>
                    <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground">
                      {report.scan_target && <span>Target: {report.scan_target}</span>}
                      {report.scan_type && <span>Type: {report.scan_type}</span>}
                      <span>{format(new Date(report.created_at), "MMM d, yyyy HH:mm")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {report.report_html && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewReport(report)} title="Preview">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadReport(report)} title="Download">
                          <Download className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteReport(report.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report Preview Dialog */}
        <Dialog open={!!previewReport} onOpenChange={() => setPreviewReport(null)}>
          <DialogContent className="bg-card border-border max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {previewReport?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh] rounded border border-border">
              {previewReport?.report_html && (
                <iframe
                  srcDoc={previewReport.report_html}
                  className="w-full min-h-[60vh] border-0"
                  title="Report Preview"
                />
              )}
            </div>
            <DialogFooter>
              {previewReport && (
                <Button onClick={() => handleDownloadReport(previewReport)} className="gap-2">
                  <Download className="h-4 w-4" /> Download
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
