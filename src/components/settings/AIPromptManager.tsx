import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Brain, Save, Plus, Trash2, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  History, Pencil, Copy, Zap, RotateCcw, FileText, ChevronDown, ChevronUp,
  TestTube, Shield,
} from "lucide-react";

interface AIPrompt {
  id: string;
  name: string;
  description: string;
  prompt_key: string;
  system_prompt: string;
  user_prompt_template: string;
  provider: string;
  active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
  changed_by: string | null;
  created_at: string;
}

const providerOptions = [
  { value: "all", label: "All Providers", desc: "Works with any AI provider" },
  { value: "builtin", label: "Built-in AI", desc: "Lovable Gateway only" },
  { value: "openai-compatible", label: "OpenAI Compatible", desc: "Custom endpoints" },
  { value: "intelligence-studio", label: "Intelligence Studio", desc: "Aptean IS only" },
];

const SectionCard = ({ title, icon: Icon, description, children, iconColor = "text-primary" }: {
  title: string; icon: any; description?: string; children: React.ReactNode; iconColor?: string;
}) => (
  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-border bg-muted/20">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg bg-primary/10", iconColor === "text-severity-high" && "bg-severity-high/10")}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
    </div>
    <div className="p-6 space-y-5">{children}</div>
  </div>
);

interface AIPromptManagerProps {
  aiSettings?: {
    model: string;
    apiKey: string;
    endpointUrl: string;
    apiType: string;
    authHeaderType: string;
  };
}

export default function AIPromptManager({ aiSettings }: AIPromptManagerProps) {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [historyPromptId, setHistoryPromptId] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [testingPromptId, setTestingPromptId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ promptId: string; success: boolean; message: string; output?: string } | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ name: "", description: "", prompt_key: "", system_prompt: "", user_prompt_template: "", provider: "all" });

  const loadPrompts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (data) setPrompts(data);
    } catch (e: any) {
      console.error("Failed to load prompts:", e);
      toast({ title: "Failed to load prompts", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  const loadVersionHistory = async (promptId: string) => {
    setHistoryPromptId(promptId);
    setLoadingVersions(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompt_versions")
        .select("*")
        .eq("prompt_id", promptId)
        .order("version", { ascending: false });
      if (error) throw error;
      setVersions(data || []);
    } catch (e: any) {
      toast({ title: "Failed to load history", description: e.message, variant: "destructive" });
    } finally {
      setLoadingVersions(false);
    }
  };

  const savePrompt = async (prompt: AIPrompt) => {
    setSaving(prompt.id);
    try {
      // Save current version to history first
      await supabase.from("ai_prompt_versions").insert({
        prompt_id: prompt.id,
        version: prompt.version,
        system_prompt: prompt.system_prompt,
        user_prompt_template: prompt.user_prompt_template,
        changed_by: "admin",
      });

      // Update prompt with version bump
      const { error } = await supabase
        .from("ai_prompts")
        .update({
          name: prompt.name,
          description: prompt.description,
          system_prompt: prompt.system_prompt,
          user_prompt_template: prompt.user_prompt_template,
          provider: prompt.provider,
          active: prompt.active,
          version: prompt.version + 1,
        })
        .eq("id", prompt.id);

      if (error) throw error;
      toast({ title: "Prompt Saved", description: `"${prompt.name}" updated to v${prompt.version + 1}` });
      await loadPrompts();
      setEditingPrompt(null);
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const toggleActive = async (prompt: AIPrompt) => {
    try {
      const { error } = await supabase
        .from("ai_prompts")
        .update({ active: !prompt.active })
        .eq("id", prompt.id);
      if (error) throw error;
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, active: !p.active } : p));
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    }
  };

  const deletePrompt = async (id: string) => {
    try {
      const { error } = await supabase.from("ai_prompts").delete().eq("id", id);
      if (error) throw error;
      setPrompts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Prompt Deleted" });
    } catch (e: any) {
      toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
    }
  };

  const createPrompt = async () => {
    if (!newPrompt.name || !newPrompt.prompt_key) {
      toast({ title: "Name and key are required", variant: "destructive" });
      return;
    }
    setSaving("new");
    try {
      const { error } = await supabase.from("ai_prompts").insert(newPrompt);
      if (error) throw error;
      toast({ title: "Prompt Created", description: `"${newPrompt.name}" added` });
      setShowNewDialog(false);
      setNewPrompt({ name: "", description: "", prompt_key: "", system_prompt: "", user_prompt_template: "", provider: "all" });
      await loadPrompts();
    } catch (e: any) {
      toast({ title: "Create Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const testPrompt = async (prompt: AIPrompt) => {
    setTestingPromptId(prompt.id);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-feed", {
        body: {
          title: "Test: Critical RCE in Apache Log4j (CVE-2021-44228)",
          description: "A critical remote code execution vulnerability has been discovered in Apache Log4j library versions 2.0-beta9 to 2.14.1.",
          source: "Test Source",
          sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2021-44228",
          testPrompt: { system: prompt.system_prompt, user: prompt.user_prompt_template },
        },
      });
      if (error) throw error;
      if (data?.success) {
        setTestResult({
          promptId: prompt.id,
          success: true,
          message: "Prompt executed successfully",
          output: JSON.stringify(data.analysis, null, 2),
        });
      } else {
        throw new Error(data?.error || "Test failed");
      }
    } catch (e: any) {
      setTestResult({ promptId: prompt.id, success: false, message: e.message });
    } finally {
      setTestingPromptId(null);
    }
  };

  const restoreVersion = async (promptId: string, version: PromptVersion) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;
    const restored = { ...prompt, system_prompt: version.system_prompt, user_prompt_template: version.user_prompt_template };
    await savePrompt(restored);
    setHistoryPromptId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading AI prompts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionCard title="AI Prompt Management" icon={Brain} description="Define and manage system-level AI prompts used across the platform. Changes affect all AI-powered features.">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{prompts.length} prompt(s)</Badge>
            <Badge variant="outline" className="text-xs text-[hsl(var(--severity-low))]">
              {prompts.filter(p => p.active).length} active
            </Badge>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> New Prompt
          </Button>
        </div>
      </SectionCard>

      {/* Prompt List */}
      {prompts.map(prompt => (
        <div key={prompt.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Prompt Header */}
          <div className="px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("p-2 rounded-lg", prompt.active ? "bg-primary/10" : "bg-muted")}>
                  <FileText className={cn("h-4 w-4", prompt.active ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{prompt.name}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">{prompt.prompt_key}</Badge>
                    <Badge variant="secondary" className="text-[10px] shrink-0">v{prompt.version}</Badge>
                    {prompt.provider !== "all" && (
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">{prompt.provider}</Badge>
                    )}
                  </div>
                  {prompt.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{prompt.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={prompt.active}
                  onCheckedChange={() => toggleActive(prompt)}
                  className="scale-90"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}>
                  {expandedId === prompt.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {expandedId === prompt.id && (
            <div className="p-6 space-y-5">
              {/* Provider */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Target Provider</Label>
                <Select
                  value={editingPrompt?.id === prompt.id ? editingPrompt.provider : prompt.provider}
                  onValueChange={(v) => setEditingPrompt(prev => prev?.id === prompt.id ? { ...prev, provider: v } : { ...prompt, provider: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {providerOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        <div className="flex flex-col">
                          <span>{o.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {providerOptions.find(o => o.value === (editingPrompt?.id === prompt.id ? editingPrompt.provider : prompt.provider))?.desc}
                </p>
              </div>

              {/* System Prompt */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">System Prompt</Label>
                <Textarea
                  rows={8}
                  className="font-mono text-xs"
                  value={editingPrompt?.id === prompt.id ? editingPrompt.system_prompt : prompt.system_prompt}
                  onChange={e => setEditingPrompt(prev => prev?.id === prompt.id ? { ...prev, system_prompt: e.target.value } : { ...prompt, system_prompt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Instructions defining the AI's role and behavior</p>
              </div>

              {/* User Prompt Template */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">User Prompt Template</Label>
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  value={editingPrompt?.id === prompt.id ? editingPrompt.user_prompt_template : prompt.user_prompt_template}
                  onChange={e => setEditingPrompt(prev => prev?.id === prompt.id ? { ...prev, user_prompt_template: e.target.value } : { ...prompt, user_prompt_template: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Template variables: {"{{title}}, {{description}}, {{source}}, {{sourceUrl}}, {{content}}"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={saving === prompt.id || !editingPrompt || editingPrompt.id !== prompt.id}
                  onClick={() => editingPrompt && savePrompt(editingPrompt)}
                >
                  {saving === prompt.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save & Version
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={testingPromptId === prompt.id}
                  onClick={() => testPrompt(editingPrompt?.id === prompt.id ? editingPrompt : prompt)}
                >
                  {testingPromptId === prompt.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                  Test Prompt
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => loadVersionHistory(prompt.id)}>
                  <History className="h-3.5 w-3.5" /> Version History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(prompt.system_prompt + "\n\n" + prompt.user_prompt_template);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => deletePrompt(prompt.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>

              {/* Test Result */}
              {testResult?.promptId === prompt.id && (
                <div className={cn(
                  "p-4 rounded-lg border text-sm",
                  testResult.success
                    ? "bg-[hsl(var(--severity-low))]/5 border-[hsl(var(--severity-low))]/20"
                    : "bg-destructive/5 border-destructive/20"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--severity-low))]" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className={cn("font-medium text-xs", testResult.success ? "text-[hsl(var(--severity-low))]" : "text-destructive")}>
                      {testResult.message}
                    </span>
                  </div>
                  {testResult.output && (
                    <ScrollArea className="max-h-[200px]">
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{testResult.output}</pre>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {prompts.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No prompts configured yet</p>
          <Button size="sm" className="mt-3 gap-2" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> Create First Prompt
          </Button>
        </div>
      )}

      {/* New Prompt Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Create New AI Prompt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Prompt Name</Label>
                <Input value={newPrompt.name} onChange={e => setNewPrompt(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Vulnerability Analysis" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Prompt Key</Label>
                <Input value={newPrompt.prompt_key} onChange={e => setNewPrompt(p => ({ ...p, prompt_key: e.target.value }))} placeholder="e.g., vuln_analysis" className="font-mono" />
                <p className="text-xs text-muted-foreground">Unique identifier used in code</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description</Label>
              <Input value={newPrompt.description} onChange={e => setNewPrompt(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of this prompt's purpose" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Target Provider</Label>
              <Select value={newPrompt.provider} onValueChange={v => setNewPrompt(p => ({ ...p, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {providerOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">System Prompt</Label>
              <Textarea rows={6} className="font-mono text-xs" value={newPrompt.system_prompt} onChange={e => setNewPrompt(p => ({ ...p, system_prompt: e.target.value }))} placeholder="Define the AI's role and behavior..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">User Prompt Template</Label>
              <Textarea rows={4} className="font-mono text-xs" value={newPrompt.user_prompt_template} onChange={e => setNewPrompt(p => ({ ...p, user_prompt_template: e.target.value }))} placeholder="Template with {{variables}}..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button onClick={createPrompt} disabled={saving === "new"} className="gap-2">
              {saving === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!historyPromptId} onOpenChange={() => setHistoryPromptId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Version History
              {historyPromptId && (
                <Badge variant="secondary" className="text-xs">
                  {prompts.find(p => p.id === historyPromptId)?.name}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {loadingVersions ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No version history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map(v => (
                <div key={v.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">v{v.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                      {v.changed_by && <span className="text-xs text-muted-foreground">by {v.changed_by}</span>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => historyPromptId && restoreVersion(historyPromptId, v)}
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </Button>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">View prompt content</summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <span className="font-medium text-foreground">System:</span>
                        <pre className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground whitespace-pre-wrap font-mono text-[11px]">
                          {v.system_prompt || "(empty)"}
                        </pre>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">User Template:</span>
                        <pre className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground whitespace-pre-wrap font-mono text-[11px]">
                          {v.user_prompt_template || "(empty)"}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Security Notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/10">
        <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Access Control</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only administrators can create, edit, or delete AI prompts. All changes are versioned for audit purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
