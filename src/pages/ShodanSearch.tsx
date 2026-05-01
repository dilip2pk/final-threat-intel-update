import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Loader2, Globe, Shield, Plus, Star, Trash2, Download, AlertTriangle,
  Server, Lock, Wifi, Eye, Settings2, FileText, FileDown, Calendar, Sparkles,
  BarChart3, Activity, Monitor, ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useScheduledJobs } from "@/hooks/useScheduledJobs";
import { supabase } from "@/integrations/supabase/client";
import { AICommandGenerator } from "@/components/AICommandGenerator";

interface ShodanResult {
  ip_str?: string;
  port?: number;
  org?: string;
  isp?: string;
  os?: string;
  product?: string;
  version?: string;
  hostnames?: string[];
  domains?: string[];
  ssl?: { cert?: { subject?: { CN?: string }; expires?: string } };
  vulns?: string[];
  transport?: string;
  data?: string;
  location?: { country_name?: string; city?: string };
}

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  query_type: string;
  is_dork: boolean;
  last_run_at: string | null;
  created_at: string;
  last_total?: number | null;
  last_source?: string | null;
  last_note?: string | null;
  filters?: any;
}

const COMMON_DORKS = [
  { label: "Open RDP", query: 'port:3389 "Remote Desktop"' },
  { label: "Default Passwords", query: '"default password"' },
  { label: "Exposed Databases", query: 'port:27017 "MongoDB"' },
  { label: "Webcams", query: 'has_screenshot:true port:443' },
  { label: "Industrial Control", query: 'port:502 "Modbus"' },
  { label: "Open VNC", query: 'port:5900 "authentication disabled"' },
];

const QUERY_TYPES = [
  { value: "search", label: "Search", desc: "General keyword search", icon: Search },
  { value: "host", label: "Host/IP", desc: "Lookup a specific IP", icon: Server },
  { value: "domain", label: "Domain", desc: "DNS & subdomain info", icon: Globe },
];

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent?: string }) {
  return (
    <div className="relative overflow-hidden border border-border rounded-xl bg-card p-4 group hover:border-primary/30 transition-all duration-200">
      <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <Icon className="w-full h-full" />
      </div>
      <p className={`text-2xl font-bold tracking-tight ${accent || "text-foreground"}`}>{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default function ShodanSearch() {
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState("search");
  const [results, setResults] = useState<ShodanResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [resultSource, setResultSource] = useState<string>("");
  const [resultNote, setResultNote] = useState<string>("");
  const [facets, setFacets] = useState<Record<string, Array<{ value: string; count: number }>>>({});
  const [searching, setSearching] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isDork, setIsDork] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  const { addJob } = useScheduledJobs();
  const shodanApiKey = settings.shodan?.apiKey || "";
  const shodanEnabled = settings.shodan?.enabled ?? false;

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedFreq, setSchedFreq] = useState("daily");
  const [schedCron, setSchedCron] = useState("");
  const [aiCommandOpen, setAiCommandOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  useEffect(() => {
    supabase.from("shodan_queries").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setSavedQueries(data);
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setFacets({});
    setResultSource("");
    setResultNote("");
    try {
      // Pass apiKey if user has one configured locally; otherwise the proxy
      // falls back to the server-side SHODAN_API_KEY secret.
      const body: Record<string, unknown> = { query: query.trim(), type: queryType };
      if (shodanApiKey) body.apiKey = shodanApiKey;
      const { data, error } = await supabase.functions.invoke("shodan-proxy", { body });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Search failed");
      setResults(data.matches || []);
      setTotalResults(data.total || 0);
      setResultSource(data.source || "");
      setResultNote(data.note || "");
      setFacets(data.facets || {});
      setActiveTab("results");
      const suffix = data.source && data.source.includes("free") ? " (free-tier data)" : "";
      toast({ title: "Search Complete", description: `Found ${(data.total || 0).toLocaleString()} results${suffix}` });
    } catch (e: any) {
      toast({ title: "Search Failed", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [query, queryType, shodanApiKey, toast]);

  const handleSaveQuery = async () => {
    if (!saveName || !query) return;
    const { data } = await supabase.from("shodan_queries")
      .insert({ name: saveName, query, query_type: queryType, is_dork: isDork })
      .select().single();
    if (data) setSavedQueries(prev => [data, ...prev]);
    setSaveDialogOpen(false);
    setSaveName("");
    toast({ title: "Query Saved" });
  };

  const handleDeleteQuery = async (id: string) => {
    await supabase.from("shodan_queries").delete().eq("id", id);
    setSavedQueries(prev => prev.filter(q => q.id !== id));
    toast({ title: "Query Deleted" });
  };

  const loadSavedQuery = (q: SavedQuery) => {
    setQuery(q.query);
    setQueryType(q.query_type);
    setIsDork(q.is_dork);
  };

  const getCronForFrequency = (freq: string, customCron: string): string => {
    switch (freq) {
      case "daily": return "0 2 * * *";
      case "weekly": return "0 2 * * 1";
      case "monthly": return "0 2 1 * *";
      case "custom": return customCron;
      default: return "";
    }
  };

  const getNextRunAt = (freq: string): string | null => {
    if (freq === "once") return null;
    const now = new Date();
    switch (freq) {
      case "daily": { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(2, 0, 0, 0); return d.toISOString(); }
      case "weekly": { const d = new Date(now); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(2, 0, 0, 0); return d.toISOString(); }
      case "monthly": { const d = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0); return d.toISOString(); }
      default: return null;
    }
  };

  const handleScheduleQuery = async () => {
    if (!schedName || !query.trim()) return;
    try {
      await addJob({
        name: schedName,
        job_type: "shodan_scan",
        frequency: schedFreq,
        cron_expression: getCronForFrequency(schedFreq, schedCron),
        configuration: { query: query.trim(), queryType },
        active: true,
        next_run_at: getNextRunAt(schedFreq),
      } as any);
      toast({ title: "Scan Scheduled", description: `"${schedName}" has been scheduled` });
      setScheduleOpen(false);
      setSchedName("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const saveReportRecord = async (format: string, content?: string) => {
    try {
      await supabase.from("generated_reports").insert({
        name: `Shodan Report — ${query}`,
        format,
        report_html: content || null,
        scan_target: query,
        scan_type: "shodan",
      } as any);
    } catch {}
  };

  const exportResults = async (format: "csv" | "json" | "pdf" | "html") => {
    if (!results.length) return;
    if (format === "pdf") return exportShodanPDF();
    if (format === "html") return exportShodanHTML();
    let content: string, mimeType: string, ext: string;
    if (format === "json") {
      content = JSON.stringify(results, null, 2);
      mimeType = "application/json";
      ext = "json";
    } else {
      const headers = ["IP", "Port", "Org", "Product", "OS", "Country", "Vulnerabilities"];
      const rows = results.map(r => [r.ip_str, r.port, r.org, r.product, r.os, r.location?.country_name, r.vulns?.join(";")].join(","));
      content = [headers.join(","), ...rows].join("\n");
      mimeType = "text/csv";
      ext = "csv";
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shodan-results.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    await saveReportRecord(format, content);
    toast({ title: "Report Exported & Saved" });
  };

  const exportShodanPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      doc.setFillColor(20, 184, 166);
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setTextColor(255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Shodan Intelligence Report", margin, 16);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Query: ${query} | ${totalResults} results | Generated: ${new Date().toLocaleString()}`, margin, 24);
      const tableData = results.map(r => [
        r.ip_str || "", r.port ? `${r.transport || "tcp"}:${r.port}` : "",
        r.org || "", r.product ? `${r.product} ${r.version || ""}`.trim() : "",
        r.os || "", r.location ? `${r.location.city || ""}, ${r.location.country_name || ""}` : "",
        r.hostnames?.join(", ") || "", r.vulns?.join(", ") || "",
      ]);
      autoTable(doc, {
        startY: 35,
        head: [["IP", "Port", "Organization", "Product", "OS", "Location", "Hostnames", "Vulnerabilities"]],
        body: tableData, theme: "grid",
        headStyles: { fillColor: [20, 184, 166], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 7 }, alternateRowStyles: { fillColor: [250, 251, 252] },
        margin: { left: margin, right: margin },
        columnStyles: { 7: { cellWidth: 40, textColor: [239, 68, 68] } },
      });
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text("Confidential — Shodan Intelligence Report", margin, doc.internal.pageSize.getHeight() - 8);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
      }
      doc.save(`shodan-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      await saveReportRecord("pdf");
      toast({ title: "PDF Exported & Saved", description: "Shodan report saved as PDF" });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    }
  };

  const exportShodanHTML = async () => {
    const rows = results.map(r => `<tr><td>${r.ip_str || ""}</td><td>${r.port ? `${r.transport || "tcp"}:${r.port}` : ""}</td><td>${r.org || ""}</td><td>${r.product ? `${r.product} ${r.version || ""}`.trim() : ""}</td><td>${r.os || ""}</td><td>${r.location ? `${r.location.city || ""}, ${r.location.country_name || ""}` : ""}</td><td>${r.hostnames?.join(", ") || ""}</td><td style="color:#ef4444">${r.vulns?.join(", ") || ""}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Shodan Report</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;font-size:14px}.header{background:#14b8a6;color:#fff;padding:30px 40px}.header h1{font-size:24px}.header p{opacity:.9;font-size:13px;margin-top:4px}.content{padding:30px 40px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f1f5f9;font-weight:600;text-align:left;padding:10px 12px;border:1px solid #e2e8f0;font-size:12px;text-transform:uppercase}td{padding:10px 12px;border:1px solid #e2e8f0}tr:nth-child(even){background:#fafbfc}.footer{border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;font-size:12px;color:#64748b;margin-top:30px}@media print{.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><h1>Shodan Intelligence Report</h1><p>Query: ${query} | ${totalResults} results | Generated: ${new Date().toLocaleString()}</p></div><div class="content"><table><thead><tr><th>IP</th><th>Port</th><th>Organization</th><th>Product</th><th>OS</th><th>Location</th><th>Hostnames</th><th>Vulnerabilities</th></tr></thead><tbody>${rows}</tbody></table></div><div class="footer"><p>Confidential — Shodan Intelligence Report</p></div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `shodan-report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click(); URL.revokeObjectURL(url);
    await saveReportRecord("html", html);
    toast({ title: "HTML Exported & Saved", description: "Shodan report saved as HTML" });
  };

  const toggleResult = (idx: number) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const vulnCount = results.reduce((acc, r) => acc + (r.vulns?.length || 0), 0);
  const uniqueOrgs = new Set(results.map(r => r.org).filter(Boolean)).size;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Shodan Intelligence</h1>
                <p className="text-xs text-muted-foreground">Search for exposed devices, services, and vulnerabilities worldwide</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {searching && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">Searching...</span>
              </div>
            )}
            <Badge variant="outline" className="text-xs gap-1.5 py-1">
              <BarChart3 className="h-3 w-3" />
              {savedQueries.length} saved queries
            </Badge>
          </div>
        </div>

        {/* Stat Cards */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Results" value={totalResults.toLocaleString()} icon={Globe} accent="text-primary" />
            <StatCard label="Displayed" value={results.length} icon={Monitor} />
            <StatCard label="Vulnerabilities" value={vulnCount} icon={AlertTriangle} accent={vulnCount > 0 ? "text-destructive" : undefined} />
            <StatCard label="Organizations" value={uniqueOrgs} icon={Server} />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="bg-muted/40 border border-border p-1 h-auto">
            <TabsTrigger value="search" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Search className="h-3.5 w-3.5" /> Search
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Eye className="h-3.5 w-3.5" /> Results
              {results.length > 0 && <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{results.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Star className="h-3.5 w-3.5" /> Saved Queries
              {savedQueries.length > 0 && <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{savedQueries.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* ─── SEARCH TAB ─── */}
          <TabsContent value="search" className="space-y-5">
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Query Input */}
              <div className="lg:col-span-2 border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" /> Search Query
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Enter a search query, IP address, or domain to investigate</p>
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-3 block uppercase tracking-wider font-semibold">Query Type</Label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {QUERY_TYPES.map(qt => {
                        const Icon = qt.icon;
                        const selected = queryType === qt.value;
                        return (
                          <button key={qt.value} onClick={() => setQueryType(qt.value)}
                            className={`relative border rounded-xl p-3.5 text-left transition-all duration-200 group ${selected ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}>
                            <div className="flex items-start gap-2.5">
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"}`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className={`text-xs font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{qt.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{qt.desc}</p>
                              </div>
                            </div>
                            {selected && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Search Query</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSearch()}
                        placeholder={queryType === "host" ? "Enter IP address (e.g. 8.8.8.8)" : queryType === "domain" ? "Enter domain (e.g. example.com)" : "Enter search query or dork..."}
                        className="pl-9 font-mono bg-muted/20"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider font-semibold">Quick Dorks</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_DORKS.map(d => (
                        <button
                          key={d.label}
                          onClick={() => { setQuery(d.query); setQueryType("search"); }}
                          className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Panel */}
              <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-border bg-muted/20">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Actions
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Execute search and manage queries</p>
                </div>
                <div className="p-5 space-y-3 flex-1">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Query Preview</p>
                    <p className="text-xs font-mono text-foreground break-all">{query || "Enter a query..."}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Badge variant="outline" className="text-[9px]">{queryType}</Badge>
                      {query && COMMON_DORKS.some(d => d.query === query) && (
                        <Badge variant="outline" className="text-[9px] bg-[hsl(var(--severity-medium))]/10 text-[hsl(var(--severity-medium))] border-[hsl(var(--severity-medium))]/30">dork</Badge>
                      )}
                    </div>
                  </div>
                  {!shodanApiKey && (
                    <div className="p-3 rounded-lg bg-[hsl(var(--severity-medium))]/5 border border-[hsl(var(--severity-medium))]/20">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--severity-medium))] shrink-0 mt-0.5" />
                        <p className="text-[10px] text-[hsl(var(--severity-medium))]">Shodan API key not configured. Go to Settings → Shodan to add your key.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-5 pt-0 space-y-2.5">
                  <Button
                    onClick={handleSearch}
                    disabled={searching || !query.trim() || !shodanApiKey}
                    className="w-full gap-2 h-10 font-semibold"
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {searching ? "Searching..." : "Launch Search"}
                  </Button>
                  <Button variant="outline" onClick={() => setAiCommandOpen(true)} className="w-full gap-2 h-9 text-xs border-primary/30 text-primary hover:bg-primary/5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Query Assistant
                  </Button>
                  <Button variant="outline" onClick={() => { setSaveName(query); setSaveDialogOpen(true); }} disabled={!query.trim()} className="w-full gap-2 h-9 text-xs">
                    <Star className="h-3.5 w-3.5" /> Save Query
                  </Button>
                  <Button variant="outline" onClick={() => { setSchedName(`Shodan: ${query}`); setScheduleOpen(true); }} disabled={!query.trim()} className="w-full gap-2 h-9 text-xs">
                    <Calendar className="h-3.5 w-3.5" /> Schedule Recurring
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── RESULTS TAB ─── */}
          <TabsContent value="results" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Results {totalResults > 0 && <span className="text-muted-foreground font-normal">({totalResults.toLocaleString()} total)</span>}
              </h2>
              {results.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                      <FileDown className="h-3.5 w-3.5" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportResults("pdf")} className="gap-2 text-xs">
                      <FileText className="h-3 w-3" /> Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportResults("html")} className="gap-2 text-xs">
                      <Globe className="h-3 w-3" /> Export as HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportResults("csv")} className="gap-2 text-xs">
                      <Download className="h-3 w-3" /> Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportResults("json")} className="gap-2 text-xs">
                      <Download className="h-3 w-3" /> Export as JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Free-tier banner with note + facet aggregates */}
            {resultNote && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Free Shodan tier {resultSource && <span className="opacity-70">({resultSource})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{resultNote}</p>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(facets).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(facets).map(([facetName, items]) => (
                  <div key={facetName} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Top {facetName}
                    </p>
                    <ul className="space-y-1.5">
                      {items.slice(0, 5).map((it, i) => (
                        <li key={i} className="flex items-center justify-between text-xs">
                          <span className="truncate text-foreground" title={String(it.value)}>{it.value}</span>
                          <span className="text-muted-foreground font-mono ml-2">{it.count.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {searching ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Searching Shodan...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Globe className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No results yet</p>
                <p className="text-xs text-muted-foreground">Run a search to see results here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((r, idx) => {
                  const isExpanded = expandedResults.has(idx);
                  return (
                    <div key={idx} className="group border border-border rounded-xl bg-card overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all duration-200">
                      <div className="p-4 cursor-pointer" onClick={() => toggleResult(idx)}>
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${r.vulns && r.vulns.length > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                            {r.vulns && r.vulns.length > 0 ? <AlertTriangle className="h-5 w-5" /> : <Server className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-foreground">{r.ip_str}</span>
                              {r.port && <Badge variant="outline" className="text-[10px] font-mono">{r.transport || "tcp"}:{r.port}</Badge>}
                              {r.org && <span className="text-xs text-muted-foreground hidden md:inline">• {r.org}</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {r.hostnames && r.hostnames.length > 0 && (
                                <span className="text-[11px] text-muted-foreground font-mono">{r.hostnames[0]}</span>
                              )}
                              {r.location && (
                                <span className="text-[11px] text-muted-foreground">{r.location.city}, {r.location.country_name}</span>
                              )}
                              {r.product && (
                                <span className="text-[11px] text-muted-foreground">{r.product} {r.version || ""}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.vulns && r.vulns.length > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                                {r.vulns.length} CVE{r.vulns.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border bg-muted/10 p-4 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {r.org && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Organization</p>
                                <p className="text-xs text-foreground mt-0.5">{r.org}</p>
                              </div>
                            )}
                            {r.os && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">OS</p>
                                <p className="text-xs text-foreground mt-0.5">{r.os}</p>
                              </div>
                            )}
                            {r.product && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Product</p>
                                <p className="text-xs text-foreground mt-0.5">{r.product} {r.version || ""}</p>
                              </div>
                            )}
                            {r.ssl?.cert?.subject?.CN && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">SSL Certificate</p>
                                <p className="text-xs text-foreground mt-0.5 flex items-center gap-1"><Lock className="h-3 w-3" /> {r.ssl.cert.subject.CN}</p>
                              </div>
                            )}
                            {r.isp && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ISP</p>
                                <p className="text-xs text-foreground mt-0.5">{r.isp}</p>
                              </div>
                            )}
                            {r.location && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Location</p>
                                <p className="text-xs text-foreground mt-0.5">{r.location.city}, {r.location.country_name}</p>
                              </div>
                            )}
                            {r.hostnames && r.hostnames.length > 0 && (
                              <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Hostnames</p>
                                <p className="text-xs text-foreground mt-0.5 font-mono">{r.hostnames.join(", ")}</p>
                              </div>
                            )}
                          </div>

                          {r.vulns && r.vulns.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Vulnerabilities</p>
                              <div className="flex flex-wrap gap-1.5">
                                {r.vulns.map(v => (
                                  <Badge key={v} variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">
                                    {v}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {r.data && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Banner Data</p>
                              <pre className="text-[11px] font-mono bg-muted/30 border border-border rounded-lg p-3 overflow-x-auto max-h-32 text-foreground/80">
                                {r.data.slice(0, 500)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── SAVED QUERIES TAB ─── */}
          <TabsContent value="saved" className="space-y-3">
            {savedQueries.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Star className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No saved queries</p>
                <p className="text-xs text-muted-foreground">Save a search query to quickly access it later</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedQueries.map(q => (
                  <div key={q.id} className="group border border-border rounded-xl bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[hsl(var(--severity-medium))]/10 flex items-center justify-center shrink-0">
                        <Star className="h-5 w-5 text-[hsl(var(--severity-medium))]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{q.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{q.query}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-[9px]">{q.query_type}</Badge>
                          {q.is_dork && <Badge variant="outline" className="text-[9px] bg-[hsl(var(--severity-medium))]/10 text-[hsl(var(--severity-medium))] border-[hsl(var(--severity-medium))]/30">dork</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => { loadSavedQuery(q); setActiveTab("search"); }}>
                          <Search className="h-3 w-3" /> Use
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteQuery(q.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save Query Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle className="text-base">Save Query</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium">Name</Label>
                <Input value={saveName} onChange={e => setSaveName(e.target.value)} className="mt-1.5 bg-muted/20" placeholder="My saved query" />
              </div>
              <div>
                <Label className="text-xs font-medium">Query</Label>
                <Input value={query} readOnly className="mt-1.5 font-mono text-muted-foreground bg-muted/20" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={isDork} onChange={e => setIsDork(e.target.checked)} id="isDork" className="rounded" />
                <Label htmlFor="isDork" className="text-xs">Mark as dork</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveQuery} className="gap-1.5">
                <Star className="h-3.5 w-3.5" /> Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Query Dialog */}
        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle className="text-base">Schedule Shodan Scan</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium">Schedule Name</Label>
                <Input value={schedName} onChange={e => setSchedName(e.target.value)} className="mt-1.5 bg-muted/20" placeholder="My scheduled scan" />
              </div>
              <div>
                <Label className="text-xs font-medium">Query</Label>
                <Input value={query} readOnly className="mt-1.5 font-mono text-muted-foreground bg-muted/20" />
              </div>
              <div>
                <Label className="text-xs font-medium">Frequency</Label>
                <Select value={schedFreq} onValueChange={setSchedFreq}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom (Cron)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {schedFreq === "custom" && (
                <div>
                  <Label className="text-xs font-medium">Cron Expression</Label>
                  <Input value={schedCron} onChange={e => setSchedCron(e.target.value)} className="mt-1.5 font-mono bg-muted/20" placeholder="0 2 * * *" />
                  <p className="text-[10px] text-muted-foreground mt-1">e.g. "0 2 * * *" = daily at 2am</p>
                </div>
              )}
              {schedFreq !== "once" && schedFreq !== "custom" && (
                <div className="text-xs text-muted-foreground p-3 rounded bg-muted border border-border">
                  <span className="font-medium text-foreground">Auto-scheduled:</span>{" "}
                  {schedFreq === "daily" && "Runs daily at 2:00 AM (cron: 0 2 * * *)"}
                  {schedFreq === "weekly" && "Runs every Monday at 2:00 AM (cron: 0 2 * * 1)"}
                  {schedFreq === "monthly" && "Runs 1st of each month at 2:00 AM (cron: 0 2 1 * *)"}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
              <Button onClick={handleScheduleQuery} disabled={!schedName.trim()} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AICommandGenerator
          open={aiCommandOpen}
          onOpenChange={setAiCommandOpen}
          type="shodan"
          onSelectCommand={(cmd) => {
            setQuery(cmd);
            setQueryType("search");
          }}
        />
      </div>
    </AppLayout>
  );
}
