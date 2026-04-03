import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Crosshair, Plus, Search, BookOpen, AlertTriangle, Clock, Trash2, Play, Archive,
  Database, Brain, RefreshCw, Globe, Shield, Hash, Link2, Bug, Eye, EyeOff, Loader2,
  ExternalLink, ChevronDown,
} from "lucide-react";
import { useThreatHunts, type ThreatHunt } from "@/hooks/useThreatHunts";
import { useThreatIntel, type ThreatIntelIOC, type ThreatIntelReport } from "@/hooks/useThreatIntel";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const severityColor: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  low: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  info: "bg-muted text-muted-foreground",
};

const iocTypeIcon: Record<string, typeof Globe> = {
  ip: Globe,
  domain: Globe,
  url: Link2,
  hash_md5: Hash,
  hash_sha1: Hash,
  hash_sha256: Hash,
  cve: Bug,
};

const iocTypeLabel: Record<string, string> = {
  ip: "IP Address",
  domain: "Domain",
  url: "URL",
  hash_md5: "MD5 Hash",
  hash_sha1: "SHA1 Hash",
  hash_sha256: "SHA256 Hash",
  cve: "CVE",
};

const statusIcon: Record<string, typeof Clock> = {
  draft: Clock,
  running: Play,
  completed: Archive,
  archived: Archive,
};

function NewHuntDialog({ onCreated }: { onCreated: () => void }) {
  const { createHunt } = useThreatHunts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    hunt_type: "query",
    severity: "medium",
    keywords: "",
    source_types: "all",
  });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createHunt.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      hunt_type: form.hunt_type,
      severity: form.severity,
      query: {
        keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
        source_types: form.source_types === "all" ? [] : [form.source_types],
      },
      status: "draft",
    }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", description: "", hunt_type: "query", severity: "medium", keywords: "", source_types: "all" });
        onCreated();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Hunt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Threat Hunt</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Hunt name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Textarea placeholder="Description / hypothesis" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.hunt_type} onValueChange={v => setForm(f => ({ ...f, hunt_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="query">Query-based</SelectItem>
                <SelectItem value="playbook">Playbook</SelectItem>
                <SelectItem value="ioc">IOC Search</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Keywords (comma-separated)" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
          <Select value={form.source_types} onValueChange={v => setForm(f => ({ ...f, source_types: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="feed">Threat Feeds</SelectItem>
              <SelectItem value="cve">CVEs</SelectItem>
              <SelectItem value="scan">Scan Results</SelectItem>
              <SelectItem value="ioc">IOC Database</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={!form.name.trim() || createHunt.isPending} className="w-full">
            {createHunt.isPending ? "Creating..." : "Create Hunt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HuntCard({ hunt, onDelete }: { hunt: ThreatHunt; onDelete: (id: string) => void }) {
  const StatusIcon = statusIcon[hunt.status] || Clock;
  const queryData = hunt.query as any;

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-foreground truncate">{hunt.name}</h3>
              <Badge variant="outline" className={severityColor[hunt.severity] || ""}>
                {hunt.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <StatusIcon className="h-2.5 w-2.5 mr-1" />
                {hunt.status}
              </Badge>
            </div>
            {hunt.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{hunt.description}</p>
            )}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="capitalize">{hunt.hunt_type}</span>
              <span>•</span>
              <span>{hunt.findings_count} findings</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(hunt.created_at), { addSuffix: true })}</span>
              {queryData?.keywords?.length > 0 && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[200px]">Keywords: {queryData.keywords.join(", ")}</span>
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => onDelete(hunt.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IOCCard({ ioc, onWhitelist }: { ioc: ThreatIntelIOC; onWhitelist: (id: string) => void }) {
  const Icon = iocTypeIcon[ioc.ioc_type] || Shield;
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <code className="text-xs font-mono text-foreground truncate">{ioc.ioc_value}</code>
              <Badge variant="outline" className="text-[10px]">
                {iocTypeLabel[ioc.ioc_type] || ioc.ioc_type}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {Math.round(ioc.confidence * 100)}%
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">{ioc.source_article_title || ioc.source_feed_name}</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{ioc.source_feed_name}</span>
              <span>•</span>
              <span>Seen {ioc.sighting_count}x</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(ioc.last_seen), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {ioc.source_article_url && (
              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                <a href={ioc.source_article_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onWhitelist(ioc.id)} title="Whitelist (hide)">
              <EyeOff className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IntelReportCard({ report }: { report: ThreatIntelReport }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
              <h3 className="text-sm font-semibold text-foreground truncate">{report.source_article_title || "Behavioral Analysis"}</h3>
              <Badge variant="outline" className={severityColor[report.severity] || ""}>
                {report.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px] capitalize">{report.report_type}</Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{report.summary}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {report.source_article_url && (
              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                <a href={report.source_article_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {report.threat_actors.map(a => (
            <Badge key={a} variant="destructive" className="text-[10px]">{a}</Badge>
          ))}
          {report.ttps.slice(0, 3).map(t => (
            <Badge key={t} variant="secondary" className="text-[10px] font-mono">{t}</Badge>
          ))}
          {report.affected_sectors.map(s => (
            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
          ))}
        </div>
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {report.affected_products.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">Affected Products:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {report.affected_products.map(p => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              </div>
            )}
            {report.ttps.length > 3 && (
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">All TTPs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {report.ttps.map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-mono">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Source: {report.source_feed_name}</span>
              <span>•</span>
              <span>Model: {report.ai_model_used}</span>
              <span>•</span>
              <span>{format(new Date(report.created_at), 'MMM d, yyyy HH:mm')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ThreatHunt() {
  const { hunts, playbooks, isLoading, deleteHunt } = useThreatHunts();
  const {
    iocs, reports, processingStats, isLoadingIOCs, isLoadingReports,
    processing, processResult, runProcessing, whitelistIOC, refresh,
  } = useThreatIntel();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [iocTypeFilter, setIocTypeFilter] = useState("all");
  const [tab, setTab] = useState("hunts");
  const [deepScrape, setDeepScrape] = useState(true);
  const [skipAI, setSkipAI] = useState(false);

  const filteredHunts = hunts.filter(h => {
    if (statusFilter !== "all" && h.status !== statusFilter) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase()) && !h.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredIOCs = iocs.filter(i => {
    if (iocTypeFilter !== "all" && i.ioc_type !== iocTypeFilter) return false;
    if (search && !i.ioc_value.toLowerCase().includes(search.toLowerCase()) && !i.source_article_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredReports = reports.filter(r => {
    if (search && !r.source_article_title?.toLowerCase().includes(search.toLowerCase()) && !r.summary?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleProcess = async () => {
    try {
      const result = await runProcessing({ deep_scrape: deepScrape, skip_ai: skipAI });
      toast({
        title: "Processing Complete",
        description: `Processed ${result.processed} items. IOCs: ${result.iocs_extracted}, Reports: ${result.behavioral_reports}`,
      });
    } catch (e: any) {
      toast({ title: "Processing Failed", description: e.message, variant: "destructive" });
    }
  };

  const stats = {
    total: hunts.length,
    running: hunts.filter(h => h.status === "running").length,
    iocs: iocs.length,
    reports: reports.length,
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-primary" />
              Threat Hunt
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Proactive threat hunting with IOC extraction and AI-driven behavioral analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleProcess}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {processing ? "Processing..." : "Process Feeds"}
            </Button>
            <NewHuntDialog onCreated={() => {}} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Hunts", value: stats.total, icon: Search },
            { label: "Active", value: stats.running, icon: Play },
            { label: "IOCs Extracted", value: stats.iocs, icon: Database },
            { label: "Intel Reports", value: stats.reports, icon: Brain },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Process result banner */}
        {processResult && !processResult.error && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 text-xs text-foreground">
              <strong>Last Run:</strong> Processed {processResult.processed} items |
              IOCs: {processResult.iocs_extracted} |
              Reports: {processResult.behavioral_reports} |
              Remaining: {processResult.remaining}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="hunts">Hunts</TabsTrigger>
              <TabsTrigger value="iocs" className="gap-1">
                IOC Database
                {iocs.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{iocs.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1">
                Intel Reports
                {reports.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{reports.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 h-8 text-xs w-[200px]"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {tab === "hunts" && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {tab === "iocs" && (
                <Select value={iocTypeFilter} onValueChange={setIocTypeFilter}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ip">IP Address</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="hash_md5">MD5</SelectItem>
                    <SelectItem value="hash_sha1">SHA1</SelectItem>
                    <SelectItem value="hash_sha256">SHA256</SelectItem>
                    <SelectItem value="cve">CVE</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Hunts Tab */}
          <TabsContent value="hunts" className="mt-3 space-y-2">
            {isLoading ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading hunts...</CardContent></Card>
            ) : filteredHunts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Crosshair className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No hunts found. Create your first threat hunt to get started.</p>
                </CardContent>
              </Card>
            ) : (
              filteredHunts.map(hunt => (
                <HuntCard key={hunt.id} hunt={hunt} onDelete={id => deleteHunt.mutate(id)} />
              ))
            )}
          </TabsContent>

          {/* IOC Database Tab */}
          <TabsContent value="iocs" className="mt-3 space-y-2">
            {/* Processing controls */}
            <Card className="border-dashed">
              <CardContent className="p-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="deep-scrape" checked={deepScrape} onCheckedChange={setDeepScrape} />
                  <Label htmlFor="deep-scrape" className="text-xs cursor-pointer">Deep Scrape Articles</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="skip-ai" checked={skipAI} onCheckedChange={setSkipAI} />
                  <Label htmlFor="skip-ai" className="text-xs cursor-pointer">Skip AI Analysis</Label>
                </div>
                <div className="text-[10px] text-muted-foreground ml-auto">
                  Processed: {processingStats.completed} | Failed: {processingStats.failed}
                </div>
              </CardContent>
            </Card>

            {isLoadingIOCs ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading IOCs...</CardContent></Card>
            ) : filteredIOCs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No IOCs found. Click "Process Feeds" to extract IOCs from your RSS feeds.</p>
                </CardContent>
              </Card>
            ) : (
              filteredIOCs.map(ioc => (
                <IOCCard key={ioc.id} ioc={ioc} onWhitelist={whitelistIOC} />
              ))
            )}
          </TabsContent>

          {/* Intel Reports Tab */}
          <TabsContent value="reports" className="mt-3 space-y-2">
            {isLoadingReports ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading reports...</CardContent></Card>
            ) : filteredReports.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No AI-generated intel reports yet. Process feeds without IOCs to generate behavioral analysis.</p>
                </CardContent>
              </Card>
            ) : (
              filteredReports.map(report => (
                <IntelReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>

          {/* Playbooks Tab */}
          <TabsContent value="playbooks" className="mt-3 space-y-2">
            {playbooks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No playbooks available yet.</p>
                </CardContent>
              </Card>
            ) : (
              playbooks.map(pb => (
                <Card key={pb.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{pb.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{pb.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px]">{pb.category}</Badge>
                          <Badge variant="outline" className={severityColor[pb.severity] || ""}>{pb.severity}</Badge>
                          {pb.tags.map(t => (
                            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <Badge variant={pb.is_builtin ? "default" : "outline"} className="text-[10px] shrink-0">
                        {pb.is_builtin ? "Built-in" : "Custom"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
