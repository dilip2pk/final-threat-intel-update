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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Copy, FileDown, ExternalLink, Shield, Wrench, Loader2,
  Brain, Mail, Ticket, AlertTriangle, Link2, Server, Tag, Clock, Globe, Sparkles, CheckCircle
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
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketImpact, setTicketImpact] = useState("2");
  const [ticketUrgency, setTicketUrgency] = useState("2");
  const [ticketWorkNotes, setTicketWorkNotes] = useState("");

  if (!feedItem) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">Feed item not found. Please navigate from the dashboard.</p>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
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
        sourceUrl: feedItem.link,
        model: settings.ai.model,
        endpointUrl: settings.ai.endpointUrl,
        apiKey: settings.ai.apiKey,
        apiType: (settings.ai as any).apiType,
        authHeaderType: (settings.ai as any).authHeaderType,
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
    const recipients = emailTo.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    const ccRecipients = emailCc.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    try {
      const settings = await loadSettingsFromDB();
      const html = formatAnalysisHTML(feedItem.title, feedItem.feedName || "Unknown", analysis);
      await sendAnalysisEmail({
        to: recipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: emailSubject,
        body: html,
        smtpConfig: settings.smtp,
      });
      await supabase.from("email_log").insert({
        recipients, subject: emailSubject, body: html,
        related_feed_id: id, related_feed_title: feedItem.title, status: "sent",
      });
      toast({ title: "Email Sent", description: "Analysis report sent successfully" });
      setEmailDialogOpen(false);
    } catch (e: any) {
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

  const AnalysisSection = ({ icon: Icon, title, children, iconClassName }: { icon: any; title: string; children: React.ReactNode; iconClassName?: string }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className={`h-3.5 w-3.5 ${iconClassName || "text-primary"}`} />
        </div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      </div>
      <div className="text-[13px] text-foreground/80 leading-relaxed pl-[38px]">{children}</div>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-0px)]">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-semibold text-foreground truncate flex-1 tracking-tight">{feedItem.title}</h1>
          {feedItem.severity && (
            <Badge variant="outline" className={`${severityColor(feedItem.severity)} uppercase font-mono text-[10px] px-2.5 py-0.5`}>
              {feedItem.severity}
            </Badge>
          )}
        </div>

        {/* Split Screen */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* LEFT: Feed Content */}
          <ResizablePanel defaultSize={38} minSize={25} maxSize={55}>
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Feed meta */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Globe className="h-3.5 w-3.5 text-primary/70" /> {feedItem.feedName || "Unknown"}
                    </span>
                    <span className="text-border">•</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {formatDate(feedItem.pubDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {feedItem.category && (
                      <Badge variant="secondary" className="text-[10px] gap-1 font-medium">
                        <Tag className="h-2.5 w-2.5" /> {feedItem.category}
                      </Badge>
                    )}
                    {feedItem.cves?.map(cve => (
                      <Badge key={cve} variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">
                        {cve}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Description Card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Description</h3>
                  <p className="text-[13px] text-foreground/85 leading-[1.75]">{feedItem.description}</p>
                </div>

                {/* Content */}
                {feedItem.content && feedItem.content !== feedItem.description && (
                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Full Content</h3>
                    <p className="text-[13px] text-foreground/85 leading-[1.75]">{feedItem.content}</p>
                  </div>
                )}

                {/* Impacted Systems */}
                {feedItem.impactedSystems && feedItem.impactedSystems.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Server className="h-3 w-3 text-primary" /> Impacted Systems
                    </h3>
                    <ul className="text-[13px] text-foreground/85 space-y-1.5 list-disc list-inside">
                      {feedItem.impactedSystems.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}

                {/* Indicators */}
                {feedItem.indicators && feedItem.indicators.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-severity-high" /> Indicators
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {feedItem.indicators.map((ind, i) => (
                        <code key={i} className="text-[11px] bg-muted/50 px-2.5 py-1 rounded-md border border-border font-mono text-foreground">
                          {ind}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Known Mitigations */}
                {feedItem.mitigations && feedItem.mitigations.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Wrench className="h-3 w-3 text-primary" /> Known Mitigations
                    </h3>
                    <ul className="text-[13px] text-foreground/85 space-y-1.5 list-disc list-inside">
                      {feedItem.mitigations.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}

                {/* Source link */}
                {feedItem.link && (
                  <a href={feedItem.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium group">
                    <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" /> View Original Source
                  </a>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT: AI Analysis */}
          <ResizablePanel defaultSize={62} minSize={35}>
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground tracking-tight">AI Analysis</h2>
                      <p className="text-[10px] text-muted-foreground">Powered by threat intelligence engine</p>
                    </div>
                  </div>
                  {analysis && (
                    <Badge variant="outline" className={`${severityColor(analysis.severity)} uppercase font-mono text-[10px] px-2.5 py-0.5`}>
                      {analysis.severity}
                    </Badge>
                  )}
                </div>

                {/* Empty state */}
                {!analysis && !analyzing && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-5 border border-dashed border-border/60 rounded-xl bg-muted/10">
                    <div className="h-16 w-16 rounded-2xl bg-primary/5 border border-primary/15 flex items-center justify-center">
                      <Brain className="h-8 w-8 text-primary/40" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-foreground/70">No analysis generated yet</p>
                      <p className="text-xs text-muted-foreground">Generate an AI-powered threat analysis report</p>
                    </div>
                    <Button onClick={runAnalysis} className="gap-2 shadow-sm" size="lg">
                      <Sparkles className="h-4 w-4" /> Generate Analysis
                    </Button>
                  </div>
                )}

                {/* Loading */}
                {analyzing && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-5">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-2xl bg-primary/5 border border-primary/15 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-foreground/70">Analyzing threat intelligence…</p>
                      <p className="text-xs text-muted-foreground">This may take a few moments</p>
                    </div>
                  </div>
                )}

                {/* Analysis results */}
                {analysis && (
                  <>
                    {/* Action bar */}
                    <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-muted/30 border border-border/50">
                      <Button variant="ghost" size="sm" onClick={copyReport} className="gap-1.5 text-xs h-8 hover:bg-background">
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button variant="ghost" size="sm" onClick={exportMarkdown} className="gap-1.5 text-xs h-8 hover:bg-background">
                        <FileDown className="h-3.5 w-3.5" /> Export
                      </Button>
                      <Separator orientation="vertical" className="h-5 mx-1" />
                      <Button variant="ghost" size="sm" onClick={openEmailDialog} className="gap-1.5 text-xs h-8 hover:bg-background">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </Button>
                      <Button variant="ghost" size="sm" onClick={openTicketDialog} className="gap-1.5 text-xs h-8 hover:bg-background">
                        <Ticket className="h-3.5 w-3.5" /> Ticket
                      </Button>
                      <Button variant="outline" size="sm" onClick={runAnalysis} disabled={analyzing} className="gap-1.5 text-xs h-8 ml-auto">
                        <Brain className="h-3.5 w-3.5" /> Re-analyze
                      </Button>
                    </div>

                    {/* Sections */}
                    <div className="space-y-6">
                      <AnalysisSection icon={Shield} title="Summary">
                        <p className="leading-relaxed">{analysis.summary}</p>
                      </AnalysisSection>

                      <Separator />

                      <AnalysisSection icon={AlertTriangle} title="Impact Analysis" iconClassName="text-severity-high">
                        <ul className="space-y-2">
                          {analysis.impact_analysis
                            .split(/(?:\n[-•*]\s*|\n\d+[.)]\s*|\n{2,})/)
                            .map(s => s.trim())
                            .filter(Boolean)
                            .map((point, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-severity-high/60 mt-0.5 shrink-0" />
                                <span>{point}</span>
                              </li>
                            ))}
                        </ul>
                      </AnalysisSection>

                      {analysis.affected_versions.length > 0 && (
                        <>
                          <Separator />
                          <AnalysisSection icon={Server} title="Affected Versions">
                            <ul className="list-disc list-inside space-y-1.5">
                              {analysis.affected_versions.map((v, i) => <li key={i}>{v}</li>)}
                            </ul>
                          </AnalysisSection>
                        </>
                      )}

                      <Separator />

                      <AnalysisSection icon={Wrench} title="Mitigations & Recommendations" iconClassName="text-primary">
                        <ul className="space-y-2.5">
                          {analysis.mitigations.map((m, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <CheckCircle className="h-3.5 w-3.5 text-primary/60 mt-0.5 shrink-0" />
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </AnalysisSection>

                      <Separator />

                      <AnalysisSection icon={Link2} title="Reference Links">
                        <ul className="space-y-2">
                          {analysis.reference_links.map((link, i) => {
                            const urlMatch = link.match(/https?:\/\/[^\s)]+/);
                            const cleanUrl = urlMatch ? urlMatch[0] : link;
                            const label = link.replace(cleanUrl, "").replace(/[()[\]]/g, "").trim();
                            return (
                              <li key={i} className="flex items-start gap-2">
                                <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />
                                <div>
                                  <a
                                    href={cleanUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80 hover:underline underline-offset-2 font-mono text-xs break-all transition-colors"
                                    onClick={(e) => { e.stopPropagation(); window.open(cleanUrl, "_blank"); e.preventDefault(); }}
                                  >
                                    {cleanUrl}
                                  </a>
                                  {label && <span className="text-xs text-muted-foreground ml-1.5">— {label}</span>}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </AnalysisSection>
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
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Send Analysis via Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">To (comma, semicolon or space separated)</Label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="user@example.com, team@example.com" className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">CC (optional)</Label>
              <Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="manager@example.com" className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending || !emailTo.trim()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {sending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ServiceNow Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" /> Create ServiceNow Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Impact</Label>
                <Select value={ticketImpact} onValueChange={setTicketImpact}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - High</SelectItem>
                    <SelectItem value="2">2 - Medium</SelectItem>
                    <SelectItem value="3">3 - Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Urgency</Label>
                <Select value={ticketUrgency} onValueChange={setTicketUrgency}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - High</SelectItem>
                    <SelectItem value="2">2 - Medium</SelectItem>
                    <SelectItem value="3">3 - Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Work Notes (optional)</Label>
              <Textarea value={ticketWorkNotes} onChange={(e) => setTicketWorkNotes(e.target.value)} className="mt-1.5" placeholder="Additional notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTicket} disabled={sending || !ticketTitle.trim()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              {sending ? "Creating…" : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
