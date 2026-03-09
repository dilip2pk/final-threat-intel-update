import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Loader2, Copy, Check, Lightbulb, Sparkles, Terminal, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/apiClient";

interface GeneratedCommand {
  command: string;
  title: string;
  explanation: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface AICommandGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "nmap" | "shodan";
  onSelectCommand: (command: string) => void;
}

const EXAMPLE_PROMPTS: Record<string, string[]> = {
  nmap: [
    "Find all web servers on my local network 192.168.1.0/24",
    "Check if a host has any vulnerabilities on common ports",
    "Stealthy scan to detect OS and services without being detected",
    "Scan for open database ports like MySQL, PostgreSQL, MongoDB",
    "Full audit scan of a single server with all scripts",
  ],
  shodan: [
    "Find exposed webcams in my country",
    "Search for open MongoDB databases without authentication",
    "Find industrial control systems (SCADA/ICS)",
    "Look for servers running outdated Apache versions",
    "Find exposed remote desktop services (RDP)",
  ],
};

const difficultyColor: Record<string, string> = {
  beginner: "bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))] border-[hsl(var(--severity-low))]/30",
  intermediate: "bg-[hsl(var(--severity-medium))]/10 text-[hsl(var(--severity-medium))] border-[hsl(var(--severity-medium))]/30",
  advanced: "bg-[hsl(var(--severity-high))]/10 text-[hsl(var(--severity-high))] border-[hsl(var(--severity-high))]/30",
};

export function AICommandGenerator({ open, onOpenChange, type, onSelectCommand }: AICommandGeneratorProps) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [commands, setCommands] = useState<GeneratedCommand[]>([]);
  const [tip, setTip] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setCommands([]);
    setTip("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-command", {
        body: { type, description: description.trim() },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Generation failed");
      setCommands(data.commands || []);
      setTip(data.tip || "");
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (command: string, idx: number) => {
    navigator.clipboard.writeText(command);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const handleUse = (command: string) => {
    onSelectCommand(command);
    onOpenChange(false);
    toast({ title: "Command Applied", description: `${type === "nmap" ? "Nmap command" : "Shodan query"} has been set` });
  };

  const Icon = type === "nmap" ? Terminal : Search;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            AI {type === "nmap" ? "Nmap Command" : "Shodan Query"} Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0">
          {/* Input */}
          <div>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={`Describe what you want to ${type === "nmap" ? "scan or discover on the network" : "find on the internet"}...`}
              rows={3}
              className="bg-muted/20 text-sm"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleGenerate(); }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Press Ctrl+Enter to generate</p>
          </div>

          {/* Example prompts */}
          {commands.length === 0 && !loading && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Example prompts</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS[type].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setDescription(prompt)}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleGenerate} disabled={loading || !description.trim()} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {loading ? "Generating..." : "Generate Commands"}
          </Button>

          {/* Results */}
          {commands.length > 0 && (
            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="space-y-3 pr-3">
                {commands.map((cmd, idx) => (
                  <div key={idx} className="border border-border rounded-lg bg-card overflow-hidden group hover:border-primary/30 transition-colors">
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-semibold text-foreground">{cmd.title}</span>
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${difficultyColor[cmd.difficulty]}`}>
                          {cmd.difficulty}
                        </Badge>
                      </div>
                      <div className="bg-muted/30 border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground break-all">
                        {cmd.command}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{cmd.explanation}</p>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={() => handleCopy(cmd.command, idx)}>
                          {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === idx ? "Copied" : "Copy"}
                        </Button>
                        <Button size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => handleUse(cmd.command)}>
                          <Sparkles className="h-3 w-3" /> Use This
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {tip && (
                  <div className="flex gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] text-foreground/80 leading-relaxed">{tip}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
