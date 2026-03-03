import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { mockSources, type RssFeedSource, formatDate } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Rss, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emptySource: Omit<RssFeedSource, "id" | "lastFetched" | "totalItems"> = {
  name: "", url: "", category: "", tags: [], active: true,
};

export default function FeedManagement() {
  const [sources, setSources] = useState<RssFeedSource[]>(mockSources);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RssFeedSource | null>(null);
  const [form, setForm] = useState(emptySource);
  const [tagInput, setTagInput] = useState("");
  const { toast } = useToast();

  const openNew = () => { setEditing(null); setForm(emptySource); setTagInput(""); setDialogOpen(true); };
  const openEdit = (s: RssFeedSource) => { setEditing(s); setForm({ name: s.name, url: s.url, category: s.category, tags: s.tags, active: s.active }); setTagInput(s.tags.join(", ")); setDialogOpen(true); };

  const save = () => {
    const tags = tagInput.split(",").map(t => t.trim()).filter(Boolean);
    if (!form.name || !form.url) { toast({ title: "Error", description: "Name and URL are required", variant: "destructive" }); return; }
    if (editing) {
      setSources(sources.map(s => s.id === editing.id ? { ...s, ...form, tags } : s));
      toast({ title: "Updated", description: `${form.name} has been updated` });
    } else {
      setSources([...sources, { ...form, tags, id: Date.now().toString(), lastFetched: null, totalItems: 0 }]);
      toast({ title: "Added", description: `${form.name} has been added` });
    }
    setDialogOpen(false);
  };

  const deleteSrc = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
    toast({ title: "Deleted", description: "Feed source removed" });
  };

  const toggleActive = (id: string) => {
    setSources(sources.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Feed Sources</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your RSS intelligence feeds</p>
          </div>
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Add Feed
          </Button>
        </div>

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
                    {s.lastFetched ? formatDate(s.lastFetched) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={s.active} onCheckedChange={() => toggleActive(s.id)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSrc(s.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Feed Source" : "Add Feed Source"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="CISA Alerts" className="mt-1" /></div>
              <div><Label>URL</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/feed.xml" className="mt-1" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Government" className="mt-1" /></div>
              <div><Label>Tags (comma separated)</Label><Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="cisa, advisory, gov" className="mt-1" /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={a => setForm({ ...form, active: a })} /><Label>Active</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
