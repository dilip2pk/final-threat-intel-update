import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Copy, FileDown, ExternalLink, Shield, Wrench, Loader2,
  Brain, Mail, Ticket, AlertTriangle, Link2, Server, CheckCircle2, Tag, Clock, Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeFeed, sendAnalysisEmail, createServiceNowTicket, type AIAnalysis } from "@/lib/api";
import { formatAnalysisText, formatAnalysisHTML, formatTicketDescription } from "@/lib/formatters";
import { loadSettingsFromDB, isSmtpConfigured, isServiceNowConfigured } from "@/lib/loadSettingsFromDB";

export default function FeedDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const feedItem = location.state?.feedItem as {
    title: string;
    description: string;
    content?: string;
    link?: string;
    pubDate?: string;
    feedName?: string;
    feedId?: string;
    category?: string;
    severity?: string;
    cves?: string[];
    impactedSystems?: string[];
    indicators?: string[];
    mitigations?: string[];
  } | undefined;

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketImpact, setTicketImpact] = useState("2");
  const [ticketUrgency, setTicketUrgency] = useState("2");
  const [ticketWorkNotes, setTicketWorkNotes] = useState("");

  if (!feedItem) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">
          <p>Feed item not found. Please navigate from the dashboard.</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const settings = await loadSettingsFromDB();
      const result = await analyzeFeed({
        title: feedItem.title,
        description: feedItem.description,
        content: feedItem.content,
        source: feedItem.feedName,
        model: settings.ai.model,
      });
      setAnalysis(result);
      toast({ title: "Analysis Complete", description: "AI-generated analysis is ready" });
    } catch (e: any) {
      toast({ title: "Analysis Failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const copyReport = () => {
    if (!analysis) return;
    const text = formatAnalysisText(feedItem.title, feedItem.feedName || "Unknown", analysis);
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Full analysis report copied to clipboard" });
  };

  const exportMarkdown = () => {
    if (!analysis) return;
    const text = formatAnalysisText(feedItem.title, feedItem.feedName || "Unknown", analysis);
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Markdown file downloaded" });
  };

  const openEmailDialog = async () => {
    const settings = await loadSettingsFromDB();
    if (!isSmtpConfigured(settings.smtp)) {
      toast({ title: "SMTP Not Configured", description: "Please configure SMTP host, port, username, password and from address in Settings → Email.", variant: "destructive" });
      navigate("/settings");
      return;
    }
    setEmailSubject(`[ThreatIntel] ${feedItem.title}`);
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!analysis || !emailTo.trim()) return;
    setSending(true);
    const recipients = emailTo.split(",").map((e) => e.trim());
    try {
      const settings = await loadSettingsFromDB();
      const html = formatAnalysisHTML(feedItem.title, feedItem.feedName || "Unknown", analysis);
      await sendAnalysisEmail({
        to: recipients,
        subject: emailSubject,
        body: html,
        smtpConfig: settings.smtp,
      });
      // Log to email_log
      await supabase.from("email_log").insert({
        recipients, subject: emailSubject, body: html,
        related_feed_id: id, related_feed_title: feedItem.title, status: "sent",
      });
      toast({ title: "Email Sent", description: "Analysis report sent successfully" });
      setEmailDialogOpen(false);
    } catch (e: any) {
      // Log failed email
      await supabase.from("email_log").insert({
        recipients, subject: emailSubject,
        related_feed_id: id, related_feed_title: feedItem.title,
        status: "failed", error_message: e.message,
      });
      toast({ title: "Email Failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openTicketDialog = async () => {
    const settings = await loadSettingsFromDB();
    if (!isServiceNowConfigured(settings.serviceNow)) {
      toast({ title: "ServiceNow Not Configured", description: "Please configure ServiceNow instance URL and credentials in Settings → ServiceDesk.", variant: "destructive" });
      navigate("/settings");
      return;
    }
    setTicketTitle(feedItem.title);
    setTicketDialogOpen(true);
  };

  const handleCreateTicket = async () => {
    if (!analysis) return;
    setSending(true);
    try {
      const settings = await loadSettingsFromDB();
      const desc = formatTicketDescription(analysis);
      const result = await createServiceNowTicket({
        ticket: {
          title: ticketTitle,
          description: desc,
          impact: ticketImpact,
          urgency: ticketUrgency,
          workNotes: ticketWorkNotes,
        },
        serviceNowConfig: settings.serviceNow,
      });
      // Log to ticket_log
      const priorityMap: Record<string, string> = { "1": "Critical", "2": "High", "3": "Medium", "4": "Low" };
      await supabase.from("ticket_log").insert({
        ticket_number: result.ticketNumber || "N/A",
        title: ticketTitle,
        description: desc,
        status: "Open",
        priority: priorityMap[ticketImpact] || "Medium",
        related_feed_id: id,
        related_feed_title: feedItem.title,
        category: "Security",
      });
      toast({ title: "Ticket Created", description: result.message });
      setTicketDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Ticket Failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  const severityColor = (severity?: string) => {
    switch (severity) {
      case "critical": return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
      case "high": return "bg-severity-high/15 text-severity-high border-severity-high/30";
      case "medium": return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
      case "low": return "bg-severity-low/15 text-severity-low border-severity-low/30";
      default: return "bg-severity-info/15 text-severity-info border-severity-info/30";
    }
  };

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      <div className="text-sm text-muted-foreground pl-6">{children}</div>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-0px)]">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-semibold text-foreground truncate flex-1">{feedItem.title}</h1>
          {feedItem.severity && (
            <Badge variant="outline" className={`${severityColor(feedItem.severity)} uppercase font-mono text-xs`}>
              {feedItem.severity}
            </Badge>
          )}
        </div>

        {/* Split Screen */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* LEFT: Feed Content (40%) */}
          <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
            <ScrollArea className="h-full">
              <div className="p-5 space-y-5">
                {/* Feed meta */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {feedItem.category && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Tag className="h-3 w-3" /> {feedItem.category}
                      </Badge>
                    )}
                    {feedItem.cves?.map(cve => (
                      <Badge key={cve} variant="outline" className="text-xs font-mono bg-destructive/10 text-destructive border-destructive/20">
                        {cve}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {feedItem.feedName || "Unknown"}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(feedItem.pubDate)}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="border border-border rounded-md bg-muted/30 p-4">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feedItem.description}</p>
                </div>

                {/* Content */}
                {feedItem.content && feedItem.content !== feedItem.description && (
                  <div className="border border-border rounded-md bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Full Content</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feedItem.content}</p>
                  </div>
                )}

                {/* Impacted Systems */}
                {feedItem.impactedSystems && feedItem.impactedSystems.length > 0 && (
                  <div className="border border-border rounded-md bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Server className="h-3 w-3 text-primary" /> Impacted Systems
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      {feedItem.impactedSystems.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}

                {/* Indicators */}
                {feedItem.indicators && feedItem.indicators.length > 0 && (
                  <div className="border border-border rounded-md bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-severity-high" /> Indicators
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {feedItem.indicators.map((ind, i) => (
                        <code key={i} className="text-xs bg-background px-2 py-1 rounded border border-border font-mono text-foreground">
                          {ind}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Known Mitigations from feed */}
                {feedItem.mitigations && feedItem.mitigations.length > 0 && (
                  <div className="border border-border rounded-md bg-muted/30 p-4">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Wrench className="h-3 w-3 text-primary" /> Known Mitigations
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      {feedItem.mitigations.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}

                {/* Source link */}
                {feedItem.link && (
                  <a href={feedItem.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-mono">
                    <ExternalLink className="h-3 w-3" /> View Original Source
                  </a>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT: AI Analysis (60%) */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <ScrollArea className="h-full">
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" /> AI Analysis
                  </h2>
                  {analysis && (
                    <Badge variant="outline" className={`${severityColor(analysis.severity)} uppercase font-mono text-xs`}>
                      {analysis.severity}
                    </Badge>
                  )}
                </div>

                {/* Generate / Re-generate button */}
                {!analysis && !analyzing && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4 border border-dashed border-border rounded-lg bg-muted/20">
                    <Brain className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Click below to generate AI-powered threat analysis</p>
                    <Button onClick={runAnalysis} className="gap-2" size="lg">
                      <Brain className="h-4 w-4" /> Generate AI Analysis
                    </Button>
                  </div>
                )}

                {analyzing && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Analyzing threat intelligence...</p>
                  </div>
                )}

                {analysis && (
                  <>
                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap border-b border-border pb-4">
                      <Button variant="outline" size="sm" onClick={copyReport} className="gap-1.5 text-xs">
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportMarkdown} className="gap-1.5 text-xs">
                        <FileDown className="h-3.5 w-3.5" /> Export MD
                      </Button>
                      <Button variant="outline" size="sm" onClick={openEmailDialog} className="gap-1.5 text-xs">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </Button>
                      <Button variant="outline" size="sm" onClick={openTicketDialog} className="gap-1.5 text-xs">
                        <Ticket className="h-3.5 w-3.5" /> Ticket
                      </Button>
                      <Button variant="outline" size="sm" onClick={runAnalysis} disabled={analyzing} className="gap-1.5 text-xs ml-auto">
                        <Brain className="h-3.5 w-3.5" /> Re-analyze
                      </Button>
                    </div>

                    {/* Analysis sections */}
                    <div className="space-y-5">
                      <Section icon={Shield} title="Summary">
                        <p>{analysis.summary}</p>
                      </Section>

                      <Section icon={AlertTriangle} title="Impact Analysis">
                        <p>{analysis.impact_analysis}</p>
                      </Section>

                      {analysis.affected_versions.length > 0 && (
                        <Section icon={Server} title="Affected Versions">
                          <ul className="list-disc list-inside space-y-1">
                            {analysis.affected_versions.map((v, i) => <li key={i}>{v}</li>)}
                          </ul>
                        </Section>
                      )}

                      <Section icon={Wrench} title="Mitigations & Recommendations">
                        <ul className="list-disc list-inside space-y-1">
                          {analysis.mitigations.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </Section>

                      <Section icon={Link2} title="Reference Links">
                        <ul className="space-y-1">
                          {analysis.reference_links.map((link, i) => (
                            <li key={i}>
                              <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs">
                                {link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Send Analysis via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Recipients (comma separated)</Label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="user@example.com, team@example.com" className="mt-1" />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending || !emailTo.trim()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ServiceNow Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create ServiceNow Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Impact</Label>
                <Select value={ticketImpact} onValueChange={setTicketImpact}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - High</SelectItem>
                    <SelectItem value="2">2 - Medium</SelectItem>
                    <SelectItem value="3">3 - Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urgency</Label>
                <Select value={ticketUrgency} onValueChange={setTicketUrgency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - High</SelectItem>
                    <SelectItem value="2">2 - Medium</SelectItem>
                    <SelectItem value="3">3 - Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Work Notes (optional)</Label>
              <Textarea value={ticketWorkNotes} onChange={(e) => setTicketWorkNotes(e.target.value)} className="mt-1" placeholder="Additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTicket} disabled={sending || !ticketTitle.trim()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              {sending ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
