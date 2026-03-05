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
  Server, Lock, Wifi, Eye, Settings2, FileText, FileDown,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";

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
}

const COMMON_DORKS = [
  { label: "Open RDP", query: 'port:3389 "Remote Desktop"' },
  { label: "Default Passwords", query: '"default password"' },
  { label: "Exposed Databases", query: 'port:27017 "MongoDB"' },
  { label: "Webcams", query: 'has_screenshot:true port:443' },
  { label: "Industrial Control", query: 'port:502 "Modbus"' },
  { label: "Open VNC", query: 'port:5900 "authentication disabled"' },
];

export default function ShodanSearch() {
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState("search");
  const [results, setResults] = useState<ShodanResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searching, setSearching] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isDork, setIsDork] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();
  const shodanApiKey = (settings as any).shodan?.apiKey || "";
  const shodanEnabled = (settings as any).shodan?.enabled ?? false;

  // Load saved queries
  useEffect(() => {
    supabase.from("shodan_queries").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setSavedQueries(data);
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    if (!shodanApiKey) {
      toast({ title: "API Key Required", description: "Please configure your Shodan API key in Settings → Shodan.", variant: "destructive" });
      return;
    }
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("shodan-proxy", {
        body: { query: query.trim(), type: queryType, apiKey: shodanApiKey },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Search failed");

      setResults(data.matches || []);
      setTotalResults(data.total || 0);
      toast({ title: "Search Complete", description: `Found ${data.total || 0} results` });
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

  const exportResults = (format: "csv" | "json") => {
    if (!results.length) return;
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
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shodan Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Search for exposed devices, services, and vulnerabilities</p>
        </div>

        {/* Search Bar */}
        <div className="border border-border rounded-lg bg-card p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <Select value={queryType} onValueChange={setQueryType}>
              <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="search">Search</SelectItem>
                <SelectItem value="host">Host/IP</SelectItem>
                <SelectItem value="domain">Domain</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder={queryType === "host" ? "Enter IP address..." : queryType === "domain" ? "Enter domain..." : "Enter search query or dork..."}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="gap-2">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
            <Button variant="outline" onClick={() => { setSaveName(query); setSaveDialogOpen(true); }} disabled={!query.trim()} className="gap-2">
              <Star className="h-4 w-4" /> Save
            </Button>
          </div>

          {/* Quick Dorks */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Dorks:</span>
            {COMMON_DORKS.map(d => (
              <button
                key={d.label}
                onClick={() => { setQuery(d.query); setQueryType("search"); }}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Results */}
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Results {totalResults > 0 && <span className="text-muted-foreground font-normal">({totalResults.toLocaleString()} total)</span>}
              </h2>
              {results.length > 0 && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => exportResults("csv")} className="gap-1 text-xs h-7">
                    <Download className="h-3 w-3" /> CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => exportResults("json")} className="gap-1 text-xs h-7">
                    <Download className="h-3 w-3" /> JSON
                  </Button>
                </div>
              )}
            </div>

            {searching ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Searching Shodan...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Enter a query above to search Shodan</p>
              </div>
            ) : (
              results.map((r, idx) => (
                <div key={idx} className="border border-border rounded-lg bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">{r.ip_str}</span>
                        {r.port && <Badge variant="outline" className="text-[10px] font-mono">{r.transport || "tcp"}:{r.port}</Badge>}
                      </div>
                      {r.hostnames && r.hostnames.length > 0 && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.hostnames.join(", ")}</p>
                      )}
                    </div>
                    {r.location && (
                      <span className="text-xs text-muted-foreground shrink-0">{r.location.city}, {r.location.country_name}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {r.org && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Server className="h-3 w-3" /> {r.org}
                      </span>
                    )}
                    {r.product && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Wifi className="h-3 w-3" /> {r.product} {r.version}
                      </span>
                    )}
                    {r.os && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Shield className="h-3 w-3" /> {r.os}
                      </span>
                    )}
                    {r.ssl?.cert?.subject?.CN && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" /> SSL: {r.ssl.cert.subject.CN}
                      </span>
                    )}
                  </div>

                  {r.vulns && r.vulns.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.vulns.map(v => (
                        <Badge key={v} variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Saved Queries Sidebar */}
          <div className="lg:w-72 shrink-0">
            <div className="border border-border rounded-lg bg-card">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Star className="h-4 w-4 text-severity-medium" /> Saved Queries
                </h3>
              </div>
              <ScrollArea className="max-h-[400px]">
                <div className="divide-y divide-border">
                  {savedQueries.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-4 text-center">No saved queries yet</p>
                  ) : (
                    savedQueries.map(q => (
                      <div key={q.id} className="p-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => loadSavedQuery(q)} className="text-left flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{q.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{q.query}</p>
                          </button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteQuery(q.id)} className="h-6 w-6 shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">{q.query_type}</Badge>
                          {q.is_dork && <Badge variant="outline" className="text-[10px] bg-severity-medium/10 text-severity-medium border-severity-medium/30">dork</Badge>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Save Query Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Save Query</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label>Name</Label><Input value={saveName} onChange={e => setSaveName(e.target.value)} className="mt-1" placeholder="My saved query" /></div>
              <div><Label>Query</Label><Input value={query} readOnly className="mt-1 font-mono text-muted-foreground" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={isDork} onChange={e => setIsDork(e.target.checked)} id="isDork" className="rounded" />
                <Label htmlFor="isDork">Mark as dork</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveQuery}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
