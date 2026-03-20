import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getSeverityBg, formatDate, type Severity } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Bell, Pencil, Trash2, Zap, Loader2, Rss, ShieldCheck, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAlertRules, useSettings } from "@/hooks/useSettings";
import { useRSSFeeds, type RSSFeedItem } from "@/hooks/useRSSFeeds";
import { useFeedSources } from "@/hooks/useFeedSources";
import { useAuth } from "@/hooks/useAuth";
import { sendAnalysisEmail } from "@/lib/api";
import { isSmtpConfigured } from "@/lib/settingsStore";

// Severity hierarchy for threshold comparison
const SEVERITY_LEVELS: Record<string, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

// Estimate severity of a feed item based on keyword indicators
function estimateSeverity(title: string, description: string): Severity {
  const text = `${title} ${description}`.toLowerCase();
  const criticalTerms = ["critical", "rce", "remote code execution", "zero-day", "0-day", "actively exploited", "emergency", "ransomware attack", "supply chain"];
  const highTerms = ["high", "exploit", "vulnerability", "cve-", "privilege escalation", "authentication bypass", "data breach", "malware"];
  const mediumTerms = ["medium", "moderate", "denial of service", "dos", "xss", "cross-site", "injection", "phishing"];
  const lowTerms = ["low", "minor", "informational", "update", "patch available", "advisory"];

  if (criticalTerms.some(t => text.includes(t))) return "critical";
  if (highTerms.some(t => text.includes(t))) return "high";
  if (mediumTerms.some(t => text.includes(t))) return "medium";
  if (lowTerms.some(t => text.includes(t))) return "low";
  return "info";
}

function meetsThreshold(itemSeverity: Severity, threshold: string): boolean {
  return (SEVERITY_LEVELS[itemSeverity] || 0) >= (SEVERITY_LEVELS[threshold] || 0);
}

export default function AlertMonitoring() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { rules, loading, addRule, updateRule, deleteRule } = useAlertRules();
  const { settings, general } = useSettings();
  const { fetchAllFeeds } = useRSSFeeds();
  const { sources: configuredSources, loading: sourcesLoading } = useFeedSources();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", keywords: "", severityThreshold: "high" as Severity, urlPattern: "", active: true });
  const [scanResults, setScanResults] = useState<{ item: RSSFeedItem; severity: Severity; matchedRules: string[] }[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();

  const hasConfiguredSources = configuredSources.length > 0;
  const globalThreshold = general.severityThreshold || "high";

  const scanToday = async () => {
    if (!hasConfiguredSources) {
      toast({ title: "No Feed Sources", description: "Please configure feed sources first.", variant: "destructive" });
      return;
    }
    setScanning(true);
    try {
      const { items } = await fetchAllFeeds();
      const today = new Date().toDateString();
      const todayFeeds = items.filter(f => f.pubDate && new Date(f.pubDate).toDateString() === today);

      const matched: typeof scanResults = [];

      for (const feed of todayFeeds) {
        const severity = estimateSeverity(feed.title, feed.description);

        // Global severity threshold filter
        if (!meetsThreshold(severity, globalThreshold)) continue;

        const matchedRuleNames: string[] = [];
        for (const rule of rules) {
          if (!rule.active) continue;
          // Rule-level severity threshold
          if (!meetsThreshold(severity, rule.severity_threshold)) continue;
          // Keyword match
          const hasKeyword = rule.keywords.length === 0 || rule.keywords.some(kw =>
            feed.title.toLowerCase().includes(kw.toLowerCase()) ||
            feed.description.toLowerCase().includes(kw.toLowerCase())
          );
          if (hasKeyword) matchedRuleNames.push(rule.name);
        }

        if (matchedRuleNames.length > 0) {
          matched.push({ item: feed, severity, matchedRules: matchedRuleNames });
        }
      }

      // Sort by severity
      matched.sort((a, b) => (SEVERITY_LEVELS[b.severity] || 0) - (SEVERITY_LEVELS[a.severity] || 0));

      setScanResults(matched);
      toast({ title: `Scan Complete`, description: `${matched.length} matches found in today's feeds (threshold: ≥${globalThreshold})` });
    } catch (e: any) {
      toast({ title: "Scan Failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
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

  if (loading || sourcesLoading || authLoading) {
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
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? "Configure rules and scan live feeds for threats — rules persist across sessions" : "View active alert rules configured by administrators"}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button onClick={scanToday} variant="outline" size="sm" className="gap-2" disabled={scanning || !hasConfiguredSources}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Scan Today
              </Button>
              <Button onClick={openNew} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add Rule
              </Button>
            </div>
          )}
        </div>

        {!hasConfiguredSources && isAdmin && (
          <div className="flex items-center gap-2 text-xs text-severity-medium p-3 rounded bg-severity-medium/10 border border-severity-medium/20">
            <Rss className="h-3.5 w-3.5" />
            No feed sources configured. Add feeds in Feed Sources to enable live scanning.
          </div>
        )}

        {!isAdmin && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded bg-muted border border-border">
            <ShieldCheck className="h-3.5 w-3.5" />
            You are viewing alert rules in read-only mode. Only administrators can create, edit, or delete rules.
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alert Rules ({rules.length})</h2>
          {rules.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{isAdmin ? 'No alert rules configured yet. Click "Add Rule" to get started.' : "No alert rules configured yet."}</p>
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
                  {!rule.active && <Badge variant="secondary" className="text-[10px]">Disabled</Badge>}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {rule.keywords.map(kw => (
                    <span key={kw} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{kw}</span>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={rule.active} onCheckedChange={() => handleToggle(rule.id, !rule.active)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(rule)} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} className="h-8 w-8 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
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
              scanResults.map((result, idx) => (
                <div key={`${result.item.id}-${idx}`} className={`border rounded-lg bg-card p-3 ${
                  result.severity === "critical" ? "border-severity-critical/30" :
                  result.severity === "high" ? "border-severity-high/30" :
                  "border-severity-medium/30"
                }`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className={`${getSeverityBg(result.severity)} text-[10px] uppercase font-mono`}>
                          {result.severity}
                        </Badge>
                        <p className="text-sm font-medium text-foreground truncate">{result.item.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {result.item.feedName} • {result.item.pubDate ? new Date(result.item.pubDate).toLocaleDateString() : "—"}
                        {result.matchedRules.length > 0 && <> • Rules: {result.matchedRules.join(", ")}</>}
                      </p>
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
