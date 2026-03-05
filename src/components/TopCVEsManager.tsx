import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TopCVE {
  id: string;
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  source_url: string;
  published_date: string;
}

const defaultForm = { cve_id: "", title: "", description: "", severity: "high", source_url: "" };

export function TopCVEsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cves, setCves] = useState<TopCVE[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("top_cves")
      .select("*")
      .order("published_date", { ascending: false });
    setCves((data as TopCVE[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (c: TopCVE) => {
    setEditingId(c.id);
    setForm({ cve_id: c.cve_id, title: c.title, description: c.description || "", severity: c.severity, source_url: c.source_url || "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.cve_id || !form.title) {
      toast({ title: "Error", description: "CVE ID and Title are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("top_cves").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Updated", description: `${form.cve_id} updated` });
      } else {
        const { error } = await supabase.from("top_cves").insert({ ...form, created_by: user?.id });
        if (error) throw error;
        toast({ title: "Added", description: `${form.cve_id} added` });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, cveId: string) => {
    await supabase.from("top_cves").delete().eq("id", id);
    toast({ title: "Deleted", description: `${cveId} removed` });
    load();
  };

  const severityColor: Record<string, string> = {
    critical: "bg-destructive/15 text-destructive",
    high: "bg-orange-500/15 text-orange-500",
    medium: "bg-yellow-500/15 text-yellow-500",
    low: "bg-primary/15 text-primary",
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading CVEs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Top CVEs Management</h2>
        </div>
        <Button onClick={openNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add CVE
        </Button>
      </div>

      {cves.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No Top CVEs added yet. Click "Add CVE" to curate your list.</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">CVE</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Title</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cves.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{c.cve_id}</td>
                  <td className="px-4 py-3 text-xs text-foreground hidden md:table-cell truncate max-w-[250px]">{c.title}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={`text-[10px] ${severityColor[c.severity] || ""}`}>{c.severity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id, c.cve_id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit CVE" : "Add Top CVE"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>CVE ID</Label><Input value={form.cve_id} onChange={e => setForm({ ...form, cve_id: e.target.value })} placeholder="CVE-2025-12345" className="mt-1" /></div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Remote code execution in..." className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the vulnerability..." className="mt-1" rows={3} /></div>
            <div>
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Source URL</Label><Input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} placeholder="https://nvd.nist.gov/vuln/detail/CVE-..." className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
