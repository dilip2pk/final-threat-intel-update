import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ClipboardCheck, Pencil, X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TrackerConfig {
  storageBucket: string;
  storageFolder: string;
  defaultProductArchitect: string;
  defaultSupportOwner: string;
  defaultRndLead: string;
  dynamicFields: Array<{
    key: string;
    label: string;
    type: "text" | "select" | "textarea";
    options?: string[];
  }>;
}

interface TrackerEntry {
  product_name: string;
  product_architect: string;
  support_owner: string;
  rnd_lead: string;
  [key: string]: string;
}

interface TrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedTitle: string;
  feedLink?: string;
  feedSource?: string;
  severity?: string;
  cveId?: string;
}

const defaultConfig: TrackerConfig = {
  storageBucket: "org-assets",
  storageFolder: "trackers",
  defaultProductArchitect: "",
  defaultSupportOwner: "",
  defaultRndLead: "",
  dynamicFields: [
    { key: "deployment_type", label: "Deployment Type", type: "select", options: ["SaaS", "On-Prem", "Both"] },
    { key: "operating_system", label: "Operating System", type: "text" },
    { key: "service_enabled", label: "Service Enabled", type: "select", options: ["Yes", "No", "TBC"] },
    { key: "package_installed", label: "Package Installed", type: "select", options: ["Yes", "No", "TBC"] },
    { key: "mitigated", label: "Mitigated?", type: "select", options: ["Yes", "No", "In Progress", "N/A"] },
    { key: "eta_upgrade", label: "ETA for Upgrade", type: "text" },
    { key: "comments", label: "Comments", type: "textarea" },
  ],
};

export function TrackerDialog({ open, onOpenChange, feedTitle, feedLink, feedSource, severity, cveId }: TrackerDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"prompt" | "edit">("prompt");
  const [config, setConfig] = useState<TrackerConfig>(defaultConfig);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Load config
  useEffect(() => {
    if (!open) return;
    setMode("prompt");
    setLoadingConfig(true);
    supabase.from("app_settings").select("value").eq("key", "tracker_config").single().then(({ data }) => {
      const val = data?.value as any;
      if (val) setConfig({ ...defaultConfig, ...val });
      setLoadingConfig(false);
    });
  }, [open]);

  const addEntry = () => {
    setEntries(prev => [...prev, {
      product_name: "",
      product_architect: config.defaultProductArchitect,
      support_owner: config.defaultSupportOwner,
      rnd_lead: config.defaultRndLead,
      deployment_type: "",
      operating_system: "",
      service_enabled: "",
      package_installed: "",
      mitigated: "No",
      eta_upgrade: "",
      comments: "",
    }]);
  };

  const removeEntry = (idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, field: string, value: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleConfirmQuick = () => {
    // Quick confirm with one default entry
    setEntries([{
      product_name: "",
      product_architect: config.defaultProductArchitect,
      support_owner: config.defaultSupportOwner,
      rnd_lead: config.defaultRndLead,
      deployment_type: "",
      operating_system: "",
      service_enabled: "",
      package_installed: "",
      mitigated: "No",
      eta_upgrade: "",
      comments: "",
    }]);
    setMode("edit");
  };

  const handleSave = async () => {
    const validEntries = entries.filter(e => e.product_name.trim());
    if (validEntries.length === 0) {
      toast({ title: "No Products", description: "Add at least one product name", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const rows = validEntries.map(entry => {
        const { product_name, product_architect, support_owner, rnd_lead, deployment_type, operating_system, service_enabled, package_installed, mitigated, eta_upgrade, comments, ...rest } = entry;
        return {
          feed_title: feedTitle,
          feed_link: feedLink || "",
          feed_source: feedSource || "",
          severity: severity || "medium",
          cve_id: cveId || "",
          product_name, product_architect, support_owner, rnd_lead,
          deployment_type, operating_system, service_enabled, package_installed,
          mitigated, eta_upgrade, comments,
          custom_fields: rest,
        };
      });

      const { error } = await supabase.from("tracker_entries").insert(rows);
      if (error) throw error;

      toast({ title: "Tracker Created", description: `${rows.length} product(s) added to tracker for "${feedTitle}"` });
      onOpenChange(false);
      setEntries([]);
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (entry: TrackerEntry, idx: number, field: TrackerConfig["dynamicFields"][0]) => {
    const value = entry[field.key] || "";
    if (field.type === "select" && field.options) {
      return (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
          <Select value={value} onValueChange={(v) => updateEntry(idx, field.key, v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (field.type === "textarea") {
      return (
        <div key={field.key} className="space-y-1 col-span-2">
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
          <Textarea value={value} onChange={e => updateEntry(idx, field.key, e.target.value)} className="text-xs min-h-[60px]" />
        </div>
      );
    }
    return (
      <div key={field.key} className="space-y-1">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <Input value={value} onChange={e => updateEntry(idx, field.key, e.target.value)} className="h-8 text-xs" />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`bg-card border-border ${mode === "edit" ? "max-w-4xl" : "max-w-md"}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            {mode === "prompt" ? "Add to Tracker?" : "Edit Tracker Entry"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "prompt"
              ? "Track this vulnerability across your products to monitor remediation status."
              : `Tracking: ${feedTitle}`}
          </DialogDescription>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : mode === "prompt" ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground line-clamp-2">{feedTitle}</h4>
              <div className="flex items-center gap-2">
                {severity && <Badge variant="outline" className="text-[10px] uppercase font-mono">{severity}</Badge>}
                {cveId && <Badge variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">{cveId}</Badge>}
                {feedSource && <span className="text-[10px] text-muted-foreground">{feedSource}</span>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This will create a tracker to monitor which products in your organization are affected and their remediation status.
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={handleConfirmQuick} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" onClick={handleConfirmQuick} className="gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" /> Confirm
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {severity && <Badge variant="outline" className="text-[10px] uppercase font-mono">{severity}</Badge>}
                {cveId && <Badge variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">{cveId}</Badge>}
              </div>
              <Button variant="outline" size="sm" onClick={addEntry} className="gap-1.5 text-xs h-7">
                <Plus className="h-3 w-3" /> Add Product
              </Button>
            </div>

            <ScrollArea className="max-h-[55vh]">
              <div className="space-y-4 pr-2">
                {entries.map((entry, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Product #{idx + 1}</span>
                      {entries.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeEntry(idx)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Core fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs text-muted-foreground">Product Name *</Label>
                        <Input value={entry.product_name} onChange={e => updateEntry(idx, "product_name", e.target.value)} className="h-8 text-xs" placeholder="e.g. Aptean CRM" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Product Architect/Manager</Label>
                        <Input value={entry.product_architect} onChange={e => updateEntry(idx, "product_architect", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Support Owner</Label>
                        <Input value={entry.support_owner} onChange={e => updateEntry(idx, "support_owner", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">R&D Lead</Label>
                        <Input value={entry.rnd_lead} onChange={e => updateEntry(idx, "rnd_lead", e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>

                    <Separator />

                    {/* Dynamic fields from config */}
                    <div className="grid grid-cols-2 gap-3">
                      {config.dynamicFields.map(field => renderField(entry, idx, field))}
                    </div>
                  </div>
                ))}

                {entries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No products added yet. Click "Add Product" to start tracking.</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || entries.length === 0} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                {saving ? "Saving..." : `Save ${entries.length} Product(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
