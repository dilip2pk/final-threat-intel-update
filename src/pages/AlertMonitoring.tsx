import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { mockFeedItems, getSeverityBg, formatDate, type Severity } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Bell, Pencil, Trash2, Zap, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAlertRules } from "@/hooks/useSettings";

export default function AlertMonitoring() {
  const { rules, loading, addRule, updateRule, deleteRule } = useAlertRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", keywords: "", severityThreshold: "high" as Severity, urlPattern: "", active: true });
  const [scanResults, setScanResults] = useState<typeof mockFeedItems | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const scanToday = () => {
    const today = new Date().toDateString();
    const todayFeeds = mockFeedItems.filter(f => new Date(f.publishedDate).toDateString() === today);
    const matched = todayFeeds.filter(feed => {
      return rules.some(rule => {
        if (!rule.active) return false;
        return rule.keywords.some(kw => feed.title.toLowerCase().includes(kw.toLowerCase()) || feed.description.toLowerCase().includes(kw.toLowerCase()));
      });
    });
    setScanResults(matched);
    toast({ title: `Scan Complete`, description: `${matched.length} matches found in today's feeds` });
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    const keywords = form.keywords.split(",").map(k => k.trim()).filter(Boolean);
    try {
      if (editingId) {
        await updateRule(editingId, { name: form.name, keywords, severity_threshold: form.severityThreshold, url_pattern: form.urlPattern, active: form.active });
        toast({ title: "Updated", description: `Alert rule ${form.name}` });
      } else {
        await addRule({ name: form.name, keywords, severity_threshold: form.severityThreshold, url_pattern: form.urlPattern, active: form.active });
        toast({ title: "Created", description: `Alert rule ${form.name}` });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setDialogOpen(false);
    }
  };

  const openNew = () => { setEditingId(null); setForm({ name: "", keywords: "", severityThreshold: "high", urlPattern: "", active: true }); setDialogOpen(true); };
  const openEdit = (r: typeof rules[0]) => {
    setEditingId(r.id);
    setForm({ name: r.name, keywords: r.keywords.join(", "), severityThreshold: r.severity_threshold as Severity, urlPattern: r.url_pattern, active: r.active });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteRule(id);
    toast({ title: "Deleted", description: "Alert rule removed" });
  };

  const handleToggle = async (id: string, active: boolean) => {
    await updateRule(id, { active });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading alert rules...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alert Monitoring</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure rules and scan today's feeds for threats — rules persist across sessions</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={scanToday} variant="outline" size="sm" className="gap-2">
              <Zap className="h-4 w-4" /> Scan Today
            </Button>
            <Button onClick={openNew} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alert Rules ({rules.length})</h2>
          {rules.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No alert rules configured yet. Click "Add Rule" to get started.</p>
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id} className="border border-border rounded-lg bg-card p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground text-sm">{rule.name}</span>
                  <Badge variant="outline" className={`${getSeverityBg(rule.severity_threshold as Severity)} text-[10px] uppercase font-mono`}>
                    ≥ {rule.severity_threshold}
                  </Badge>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {rule.keywords.map(kw => (
                    <span key={kw} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{kw}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={rule.active} onCheckedChange={() => handleToggle(rule.id, !rule.active)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(rule)} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} className="h-8 w-8 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>

        {scanResults !== null && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-severity-medium" /> Scan Results ({scanResults.length})
            </h2>
            {scanResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No matches found in today's feeds</p>
            ) : (
              scanResults.map(item => (
                <div key={item.id} className="border border-severity-medium/30 rounded-lg bg-card p-3">
                  <div className="flex items-start gap-2">
                    {item.severity && <Badge variant="outline" className={`${getSeverityBg(item.severity)} text-[10px] uppercase font-mono shrink-0`}>{item.severity}</Badge>}
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.sourceName} • {formatDate(item.publishedDate)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editingId ? "Edit Rule" : "New Alert Rule"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Rule Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
              <div><Label>Keywords (comma separated)</Label><Input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} placeholder="CVE, critical, RCE" className="mt-1" /></div>
              <div>
                <Label>Severity Threshold</Label>
                <Select value={form.severityThreshold} onValueChange={(v: Severity) => setForm({ ...form, severityThreshold: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["critical", "high", "medium", "low", "info"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>URL Pattern (optional)</Label><Input value={form.urlPattern} onChange={e => setForm({ ...form, urlPattern: e.target.value })} className="mt-1" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
