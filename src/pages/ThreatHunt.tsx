import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Crosshair, Plus, Search, BookOpen, AlertTriangle, Clock, Trash2, Play, Archive } from "lucide-react";
import { useThreatHunts, type ThreatHunt } from "@/hooks/useThreatHunts";
import { formatDistanceToNow } from "date-fns";

const severityColor: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  low: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  info: "bg-muted text-muted-foreground",
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
                  <span className="truncate max-w-[200px]">
                    Keywords: {queryData.keywords.join(", ")}
                  </span>
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

export default function ThreatHunt() {
  const { hunts, playbooks, isLoading, deleteHunt } = useThreatHunts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState("hunts");

  const filteredHunts = hunts.filter(h => {
    if (statusFilter !== "all" && h.status !== statusFilter) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase()) && !h.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: hunts.length,
    running: hunts.filter(h => h.status === "running").length,
    findings: hunts.reduce((sum, h) => sum + h.findings_count, 0),
    playbooks: playbooks.length,
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
              Proactive threat hunting across feeds, CVEs, scans, and IOCs
            </p>
          </div>
          <NewHuntDialog onCreated={() => {}} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Hunts", value: stats.total, icon: Search },
            { label: "Active", value: stats.running, icon: Play },
            { label: "Findings", value: stats.findings, icon: AlertTriangle },
            { label: "Playbooks", value: stats.playbooks, icon: BookOpen },
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

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="hunts">Hunts</TabsTrigger>
              <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search hunts..."
                  className="pl-8 h-8 text-xs w-[200px]"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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

          <TabsContent value="playbooks" className="mt-3 space-y-2">
            {playbooks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No playbooks available yet. Playbooks provide step-by-step hunting guides.</p>
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
