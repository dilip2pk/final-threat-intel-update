import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Rss, Loader2, Zap, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFeedSources } from "@/hooks/useFeedSources";
import { formatDate } from "@/lib/mockData";

export default function FeedManagement() {
  const { sources, loading, addSource, updateSource, deleteSource, testFeedUrl } = useFeedSources();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", url: "", category: "", active: true });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", url: "", category: "", active: true });
    setTagInput("");
    setTestResult(null);
    setDialogOpen(true);
  };

  const openEdit = (s: typeof sources[0]) => {
    setEditingId(s.id);
    setForm({ name: s.name, url: s.url, category: s.category, active: s.active });
    setTagInput(s.tags.join(", "));
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleTest = async () => {
    if (!form.url) return;
    setTesting(true);
    setTestResult(null);
    const result = await testFeedUrl(form.url);
    setTestResult(result);
    setTesting(false);
  };

  const save = async () => {
    if (!form.name || !form.url) {
      toast({ title: "Error", description: "Name and URL are required", variant: "destructive" });
      return;
    }

    // Basic URL validation
    try {
      new URL(form.url);
    } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid feed URL", variant: "destructive" });
      return;
    }

    setSaving(true);
    const tags = tagInput.split(",").map(t => t.trim()).filter(Boolean);
    try {
      if (editingId) {
        const { error } = await updateSource(editingId, { ...form, tags });
        if (error) throw new Error("Failed to update feed");
        toast({ title: "Updated", description: `${form.name} has been updated` });
      } else {
        const { error } = await addSource({ ...form, tags });
        if (error) throw new Error("Failed to add feed");
        toast({ title: "Added", description: `${form.name} has been added` });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSource(id);
    toast({ title: "Deleted", description: "Feed source removed" });
  };

  const handleToggle = async (id: string, active: boolean) => {
    await updateSource(id, { active });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading feed sources...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Feed Sources</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your RSS intelligence feeds — all changes persist to the database</p>
          </div>
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add Feed
          </Button>
        </div>

        {sources.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
            <Rss className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No feed sources configured yet. Click "Add Feed" to get started.</p>
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Last Fetched</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Rss className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{s.url}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{s.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden lg:table-cell">
                      {s.last_fetched ? formatDate(s.last_fetched) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={s.active} onCheckedChange={() => handleToggle(s.id, !s.active)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
              <DialogTitle>{editingId ? "Edit Feed Source" : "Add Feed Source"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="CISA Alerts" className="mt-1" /></div>
              <div>
                <Label>URL</Label>
                <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/feed.xml" className="mt-1" />
              </div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Government" className="mt-1" /></div>
              <div><Label>Tags (comma separated)</Label><Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="cisa, advisory, gov" className="mt-1" /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={a => setForm({ ...form, active: a })} /><Label>Active</Label></div>

              {/* Test Connection */}
              <div className="border border-border rounded-md p-3 space-y-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !form.url} className="gap-2">
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Test Connection
                </Button>
                {testResult && (
                  <div className={`flex items-center gap-2 text-xs p-2 rounded ${
                    testResult.success ? "bg-severity-low/10 text-severity-low" : "bg-destructive/10 text-destructive"
                  }`}>
                    {testResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {testResult.message}
                  </div>
                )}
              </div>
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
    </AppLayout>
  );
}
