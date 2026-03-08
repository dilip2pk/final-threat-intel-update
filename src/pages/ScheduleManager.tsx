import { useState } from "react";
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
  Calendar, Clock, Plus, Trash2, Play, Loader2,
  Radar, Crosshair, AlertTriangle, Edit, Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useScheduledJobs, type ScheduledJob } from "@/hooks/useScheduledJobs";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";


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


  const resetForm = () => {
    setJobName(""); setJobType("shodan_scan"); setFrequency("once");
    setCronExpression(""); setShodanQuery(""); setShodanQueryType("search");
    setScanTarget(""); setScanTargetType("ip"); setScanType("quick");
    setScanPorts("");
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
    }
    setDialogOpen(true);
  };

  const buildConfig = () => {
    if (jobType === "shodan_scan") return { query: shodanQuery, queryType: shodanQueryType };
    if (jobType === "network_scan") return { target: scanTarget, targetType: scanTargetType, scanType, ports: scanPorts };
    return {};
  };

  const getCronForFrequency = (freq: string, customCron: string): string => {
    switch (freq) {
      case "daily": return "0 2 * * *";       // daily at 2am
      case "weekly": return "0 2 * * 1";      // weekly Monday 2am
      case "monthly": return "0 2 1 * *";     // 1st of month 2am
      case "custom": return customCron;
      default: return "";
    }
  };

  const getNextRunAt = (freq: string): string | null => {
    if (freq === "once") return null;
    const now = new Date();
    switch (freq) {
      case "daily": { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(2, 0, 0, 0); return d.toISOString(); }
      case "weekly": { const d = new Date(now); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(2, 0, 0, 0); return d.toISOString(); }
      case "monthly": { const d = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0); return d.toISOString(); }
      default: return null;
    }
  };

  const handleSave = async () => {
    if (!jobName.trim()) return;
    try {
      const resolvedCron = getCronForFrequency(frequency, cronExpression);
      const jobData = {
        name: jobName,
        job_type: jobType,
        frequency,
        cron_expression: resolvedCron,
        configuration: buildConfig(),
        active: true,
        next_run_at: getNextRunAt(frequency),
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
      await runJobNow(job);
      toast({ title: "Job Executed", description: `${job.name} completed successfully` });
    } catch (e: any) {
      toast({ title: "Job Failed", description: e.message, variant: "destructive" });
    } finally {
      setRunningJobId(null);
    }
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
            <p className="text-sm text-muted-foreground mt-1">Automate Shodan scans and network scans</p>
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
                    {job.next_run_at && <span>Next run: {format(new Date(job.next_run_at), "MMM d, HH:mm")}</span>}
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

              {frequency !== "once" && frequency !== "custom" && (
                <div className="text-xs text-muted-foreground p-3 rounded bg-muted border border-border">
                  <span className="font-medium text-foreground">Auto-scheduled:</span>{" "}
                  {frequency === "daily" && "Runs daily at 2:00 AM (cron: 0 2 * * *)"}
                  {frequency === "weekly" && "Runs every Monday at 2:00 AM (cron: 0 2 * * 1)"}
                  {frequency === "monthly" && "Runs 1st of each month at 2:00 AM (cron: 0 2 1 * *)"}
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

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={!jobName.trim()}>
                {editingJob ? "Update Schedule" : "Create Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
