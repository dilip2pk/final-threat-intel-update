import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardCheck, Search, Download, Trash2, Pencil, ChevronLeft, ChevronRight,
  Loader2, FileDown, Clock, Shield, ExternalLink, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface TrackerEntry {
  id: string;
  feed_title: string;
  feed_link: string;
  feed_source: string;
  severity: string;
  cve_id: string;
  product_name: string;
  product_architect: string;
  support_owner: string;
  rnd_lead: string;
  deployment_type: string;
  operating_system: string;
  service_enabled: string;
  package_installed: string;
  mitigated: string;
  eta_upgrade: string;
  comments: string;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const ITEMS_PER_PAGE = 15;

export default function TrackerPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [mitigatedFilter, setMitigatedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editEntry, setEditEntry] = useState<TrackerEntry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tracker_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEntries(data as TrackerEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let items = entries;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(e =>
        e.feed_title.toLowerCase().includes(q) ||
        e.product_name.toLowerCase().includes(q) ||
        e.cve_id.toLowerCase().includes(q) ||
        e.product_architect.toLowerCase().includes(q)
      );
    }
    if (severityFilter !== "all") items = items.filter(e => e.severity === severityFilter);
    if (mitigatedFilter !== "all") items = items.filter(e => e.mitigated === mitigatedFilter);
    return items;
  }, [entries, search, severityFilter, mitigatedFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Group by feed_title for summary
  const groupedByFeed = useMemo(() => {
    const map = new Map<string, TrackerEntry[]>();
    entries.forEach(e => {
      const group = map.get(e.feed_title) || [];
      group.push(e);
      map.set(e.feed_title, group);
    });
    return map;
  }, [entries]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tracker_entries").delete().eq("id", id);
    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== id));
      toast({ title: "Deleted", description: "Tracker entry removed" });
    }
  };

  const handleEdit = (entry: TrackerEntry) => {
    setEditEntry({ ...entry });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setSaving(true);
    const { id, created_at, updated_at, custom_fields, ...updates } = editEntry;
    const { error } = await supabase.from("tracker_entries").update(updates).eq("id", id);
    if (!error) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      toast({ title: "Updated", description: "Tracker entry saved" });
      setEditDialogOpen(false);
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const exportCSV = () => {
    const headers = ["Feed Title", "CVE ID", "Severity", "Product Name", "Product Architect", "Support Owner", "R&D Lead", "Deployment Type", "OS", "Service Enabled", "Package Installed", "Mitigated", "ETA", "Comments", "Created"];
    const rows = filtered.map(e => [
      e.feed_title, e.cve_id, e.severity, e.product_name, e.product_architect,
      e.support_owner, e.rnd_lead, e.deployment_type, e.operating_system,
      e.service_enabled, e.package_installed, e.mitigated, e.eta_upgrade, e.comments, e.created_at
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "CSV downloaded" });
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
      case "high": return "bg-severity-high/15 text-severity-high border-severity-high/30";
      case "medium": return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
      case "low": return "bg-severity-low/15 text-severity-low border-severity-low/30";
      default: return "bg-severity-info/15 text-severity-info border-severity-info/30";
    }
  };

  const mitigatedColor = (m: string) => {
    switch (m) {
      case "Yes": return "text-severity-low";
      case "No": return "text-severity-high";
      case "In Progress": return "text-severity-medium";
      default: return "text-muted-foreground";
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" /> Vulnerability Tracker
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {entries.length} product entries across {groupedByFeed.size} vulnerabilities
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5" disabled={filtered.length === 0}>
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products, CVEs, feed titles..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 bg-card" />
          </div>
          <Select value={severityFilter} onValueChange={v => { setSeverityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9"><Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mitigatedFilter} onValueChange={v => { setMitigatedFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Yes">Mitigated</SelectItem>
              <SelectItem value="No">Not Mitigated</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="N/A">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tracker entries found</p>
            <p className="text-xs text-muted-foreground mt-1">Add entries from the Feed Detail page using the Tracker button</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold w-[200px]">Feed / CVE</TableHead>
                    <TableHead className="text-xs font-semibold">Product</TableHead>
                    <TableHead className="text-xs font-semibold">Architect</TableHead>
                    <TableHead className="text-xs font-semibold">Support</TableHead>
                    <TableHead className="text-xs font-semibold">OS</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Mitigated</TableHead>
                    <TableHead className="text-xs font-semibold">ETA</TableHead>
                    <TableHead className="text-xs font-semibold">Age</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(entry => (
                    <TableRow key={entry.id} className="group hover:bg-muted/20">
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground line-clamp-1">{entry.feed_title}</p>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[9px] uppercase font-mono px-1.5 py-0 ${severityColor(entry.severity)}`}>{entry.severity}</Badge>
                            {entry.cve_id && <code className="text-[9px] text-destructive font-mono">{entry.cve_id}</code>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{entry.product_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.product_architect || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.support_owner || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.operating_system || "—"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-semibold ${mitigatedColor(entry.mitigated)}`}>{entry.mitigated}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.eta_upgrade || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)} className="h-7 w-7 p-0">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="gap-1 text-xs h-8">
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground font-mono">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="gap-1 text-xs h-8">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> Edit Tracker Entry
            </DialogTitle>
            <DialogDescription className="text-xs">{editEntry?.feed_title}</DialogDescription>
          </DialogHeader>
          {editEntry && (
            <ScrollArea className="max-h-[60vh]">
              <div className="grid grid-cols-2 gap-3 py-2 pr-2">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Product Name</Label>
                  <Input value={editEntry.product_name} onChange={e => setEditEntry({ ...editEntry, product_name: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Product Architect</Label>
                  <Input value={editEntry.product_architect} onChange={e => setEditEntry({ ...editEntry, product_architect: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Support Owner</Label>
                  <Input value={editEntry.support_owner} onChange={e => setEditEntry({ ...editEntry, support_owner: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">R&D Lead</Label>
                  <Input value={editEntry.rnd_lead} onChange={e => setEditEntry({ ...editEntry, rnd_lead: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deployment Type</Label>
                  <Select value={editEntry.deployment_type || ""} onValueChange={v => setEditEntry({ ...editEntry, deployment_type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SaaS">SaaS</SelectItem>
                      <SelectItem value="On-Prem">On-Prem</SelectItem>
                      <SelectItem value="Both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Operating System</Label>
                  <Input value={editEntry.operating_system} onChange={e => setEditEntry({ ...editEntry, operating_system: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Service Enabled</Label>
                  <Select value={editEntry.service_enabled || ""} onValueChange={v => setEditEntry({ ...editEntry, service_enabled: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="TBC">TBC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Package Installed</Label>
                  <Select value={editEntry.package_installed || ""} onValueChange={v => setEditEntry({ ...editEntry, package_installed: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="TBC">TBC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mitigated</Label>
                  <Select value={editEntry.mitigated} onValueChange={v => setEditEntry({ ...editEntry, mitigated: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ETA for Upgrade</Label>
                  <Input value={editEntry.eta_upgrade} onChange={e => setEditEntry({ ...editEntry, eta_upgrade: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Comments</Label>
                  <Textarea value={editEntry.comments} onChange={e => setEditEntry({ ...editEntry, comments: e.target.value })} className="text-xs min-h-[60px]" />
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
