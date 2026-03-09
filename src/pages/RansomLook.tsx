import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Search, Eye, Bell, BellRing, Shield, TrendingUp, Database, Globe, Calendar,
  AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Info, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { type LeakEntry } from "@/lib/ransomLookData";
import { useRansomLookAPI, type RansomLookPost } from "@/hooks/useRansomLookAPI";
import { useWatchlist } from "@/hooks/useSettings";

const ITEMS_PER_PAGE = 8;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0, 72%, 51%)",
  high: "hsl(25, 95%, 53%)",
  medium: "hsl(45, 93%, 47%)",
  low: "hsl(175, 80%, 45%)",
};

const SECTOR_COLORS = [
  "hsl(175, 80%, 45%)", "hsl(25, 95%, 53%)", "hsl(260, 60%, 55%)", "hsl(0, 72%, 51%)",
  "hsl(45, 93%, 47%)", "hsl(200, 70%, 50%)", "hsl(330, 60%, 50%)", "hsl(215, 20%, 50%)",
];

const severityBg = (s: string) => {
  switch (s) {
    case "critical": return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
    case "high": return "bg-severity-high/15 text-severity-high border-severity-high/30";
    case "medium": return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
    case "low": return "bg-severity-low/15 text-severity-low border-severity-low/30";
    default: return "bg-severity-info/15 text-severity-info border-severity-info/30";
  }
};

const statusBg = (s: string) => {
  switch (s) {
    case "confirmed": return "bg-severity-critical/10 text-severity-critical border-severity-critical/20";
    case "claimed": return "bg-severity-medium/10 text-severity-medium border-severity-medium/20";
    default: return "bg-severity-info/10 text-severity-info border-severity-info/20";
  }
};

function formatRecords(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function RansomLook() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loading: apiLoading, error: apiError, searchPosts, fetchRecentPosts } = useRansomLookAPI();
  const { items: watchlistItems, addItem: addWatchlistItem, removeItem: removeWatchlistItem } = useWatchlist();
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLeak, setSelectedLeak] = useState<LeakEntry | null>(null);
  const [selectedLivePost, setSelectedLivePost] = useState<RansomLookPost | null>(null);
  const [watchDialogOpen, setWatchDialogOpen] = useState(false);
  const [watchOrg, setWatchOrg] = useState("");
  const [notifyMethod, setNotifyMethod] = useState("email");
  const [notifyFreq, setNotifyFreq] = useState("instant");
  const [livePosts, setLivePosts] = useState<RansomLookPost[]>([]);
  const [liveSearchResults, setLiveSearchResults] = useState<RansomLookPost[] | null>(null);

  const watchlist = watchlistItems.map(w => w.organization);

  // Fetch recent posts on mount
  useEffect(() => {
    fetchRecentPosts(200).then((posts) => {
      if (posts.length > 0) {
        setLivePosts(posts);
      }
    });
  }, [fetchRecentPosts]);

  // Navigate to group dashboard
  const handleGroupClick = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/group/${encodeURIComponent(groupName)}`);
  };

  // Live search with debounce
  useEffect(() => {
    if (dataMode !== "live" || !search.trim()) {
      setLiveSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      searchPosts(search, 90).then((results) => {
        setLiveSearchResults(results);
        setPage(1);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [search, dataMode, searchPosts]);

  const sectors = useMemo(() => [...new Set(mockLeaks.map((l) => l.sector))].sort(), []);

  // Mock data filtering (used in mock mode)
  const filteredMock = useMemo(() => {
    return mockLeaks.filter((l) => {
      if (sectorFilter !== "all" && l.sector !== sectorFilter) return false;
      if (severityFilter !== "all" && l.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return l.organization.toLowerCase().includes(q) || l.groupName.toLowerCase().includes(q) || l.country.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, sectorFilter, severityFilter]);

  // Choose data source
  const displayPosts = dataMode === "live" ? (liveSearchResults ?? livePosts) : [];
  const displayMockLeaks = dataMode === "mock" ? filteredMock : [];

  const totalPages = dataMode === "live"
    ? Math.ceil(displayPosts.length / ITEMS_PER_PAGE)
    : Math.ceil(displayMockLeaks.length / ITEMS_PER_PAGE);
  const paginatedLive = displayPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const paginatedMock = displayMockLeaks.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalRecords = mockLeaks.reduce((s, l) => s + l.estimatedRecords, 0);
  const criticalCount = mockLeaks.filter((l) => l.severity === "critical").length;

  // severity distribution for pie chart
  const severityDist = useMemo(() => {
    const map: Record<string, number> = {};
    mockLeaks.forEach((l) => { map[l.severity] = (map[l.severity] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, []);

  const addToWatchlist = async () => {
    if (!watchOrg.trim()) return;
    if (watchlist.includes(watchOrg.trim())) {
      toast({ title: "Already watching", description: `${watchOrg} is already on your watchlist` });
      return;
    }
    await addWatchlistItem({ organization: watchOrg.trim(), notify_method: notifyMethod, notify_frequency: notifyFreq });
    toast({
      title: "Organization Added",
      description: `You'll be notified about "${watchOrg}" via ${notifyMethod} (${notifyFreq}).`,
    });
    setWatchOrg("");
    setWatchDialogOpen(false);
  };

  const removeFromWatchlist = async (org: string) => {
    const item = watchlistItems.find(w => w.organization === org);
    if (item) await removeWatchlistItem(item.id);
    toast({ title: "Removed", description: `${org} removed from watchlist` });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Eye className="h-6 w-6 text-primary" /> RansomLook
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ransomware leak intelligence — search organizations, track breaches, set alerts
            </p>
          </div>
          <Dialog open={watchDialogOpen} onOpenChange={setWatchDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
                <BellRing className="h-4 w-4" /> Watch Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Watch an Organization</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Organization Name</Label>
                  <Input value={watchOrg} onChange={(e) => setWatchOrg(e.target.value)} placeholder="e.g. Acme Healthcare" className="mt-1 bg-background border-border" />
                </div>
                <div>
                  <Label>Notification Method</Label>
                  <Select value={notifyMethod} onValueChange={setNotifyMethod}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={notifyFreq} onValueChange={setNotifyFreq}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant</SelectItem>
                      <SelectItem value="daily">Daily Summary</SelectItem>
                      <SelectItem value="weekly">Weekly Digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-md bg-severity-medium/10 border border-severity-medium/20">
                  <Info className="h-4 w-4 text-severity-medium shrink-0" />
                  <p className="text-xs text-severity-medium">Email/Slack delivery requires Lovable Cloud to be enabled.</p>
                </div>
                <Button onClick={addToWatchlist} className="w-full gap-2">
                  <Bell className="h-4 w-4" /> Add to Watchlist
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Leaks", value: mockLeaks.length, icon: Database, color: "text-primary" },
            { label: "Groups Tracked", value: mockRansomGroups.length, icon: Shield, color: "text-primary" },
            { label: "Records Exposed", value: formatRecords(totalRecords), icon: Globe, color: "text-severity-high" },
            { label: "Critical", value: criticalCount, icon: AlertTriangle, color: "text-severity-critical" },
            { label: "Watching", value: watchlist.length, icon: BellRing, color: "text-severity-medium" },
          ].map((s) => (
            <div key={s.label} className="border border-border rounded-md bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        <Tabs defaultValue="search" className="space-y-4">
          <TabsList className="bg-muted/30 border border-border">
            <TabsTrigger value="search">Search & Leaks</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          </TabsList>

          {/* ─── SEARCH & LEAKS TAB ─── */}
          <TabsContent value="search" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search organization, group, or country..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 bg-card border-border" />
              </div>
              <Select value={sectorFilter} onValueChange={(v) => { setSectorFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full md:w-44 bg-card border-border"><SelectValue placeholder="All Sectors" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sectors</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full md:w-40 bg-card border-border"><SelectValue placeholder="All Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  {["critical", "high", "medium", "low"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Data Mode Toggle */}
            <div className="flex items-center gap-3">
              <Button
                variant={dataMode === "live" ? "default" : "outline"}
                size="sm"
                onClick={() => { setDataMode("live"); setPage(1); }}
                className="gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" /> Live Data
              </Button>
              <Button
                variant={dataMode === "mock" ? "default" : "outline"}
                size="sm"
                onClick={() => { setDataMode("mock"); setPage(1); }}
                className="gap-1.5"
              >
                <Database className="h-3.5 w-3.5" /> Sample Data
              </Button>
              {apiLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {apiError && <span className="text-xs text-severity-critical">API error — showing cached data</span>}
            </div>

            {/* Leak Table */}
            <div className="border border-border rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      {dataMode === "live"
                        ? ["Victim / Organization", "Group", "Discovered", "Website", ""].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                          ))
                        : ["Organization", "Group", "Sector", "Country", "Severity", "Records", "Date", "Status", ""].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                          ))
                      }
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dataMode === "live" ? (
                      paginatedLive.map((post, idx) => (
                        <tr key={`${post.group_name}-${post.post_title}-${idx}`} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedLivePost(post)}>
                          <td className="px-4 py-3 font-medium text-foreground">{post.post_title || "—"}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => handleGroupClick(post.group_name, e)}
                              className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                            >
                              {post.group_name}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                            {post.discovered ? new Date(post.discovered).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]">{post.website || "—"}</td>
                          <td className="px-4 py-3">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      paginatedMock.map((leak) => (
                        <tr key={leak.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedLeak(leak)}>
                          <td className="px-4 py-3 font-medium text-foreground">{leak.organization}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{leak.groupName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{leak.sector}</td>
                          <td className="px-4 py-3 text-muted-foreground">{leak.country}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-xs capitalize ${severityBg(leak.severity)}`}>{leak.severity}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-foreground">{formatRecords(leak.estimatedRecords)}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{new Date(leak.discoveredDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-xs capitalize ${statusBg(leak.status)}`}>{leak.status.replace("_", " ")}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {((dataMode === "live" && displayPosts.length === 0 && !apiLoading) || (dataMode === "mock" && displayMockLeaks.length === 0)) && (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No leaks match your search</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (() => {
              const maxVisible = 5;
              const getPages = () => {
                if (totalPages <= maxVisible) return Array.from({ length: totalPages }, (_, i) => i + 1);
                const start = Math.max(1, page - Math.floor(maxVisible / 2));
                const end = Math.min(totalPages, start + maxVisible - 1);
                const adj = Math.max(1, end - maxVisible + 1);
                return Array.from({ length: end - adj + 1 }, (_, i) => adj + i);
              };
              const pages = getPages();
              return (
                <div className="flex items-center justify-center gap-1.5">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {pages[0] > 1 && (
                    <>
                      <button onClick={() => setPage(1)} className="px-3 py-1.5 text-xs font-mono rounded-md border border-border text-muted-foreground hover:border-muted-foreground/30">1</button>
                      {pages[0] > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
                    </>
                  )}
                  {pages.map((p) => (
                    <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${page === p ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-border hover:border-muted-foreground/30"}`}>
                      {p}
                    </button>
                  ))}
                  {pages[pages.length - 1] < totalPages && (
                    <>
                      {pages[pages.length - 1] < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                      <button onClick={() => setPage(totalPages)} className="px-3 py-1.5 text-xs font-mono rounded-md border border-border text-muted-foreground hover:border-muted-foreground/30">{totalPages}</button>
                    </>
                  )}
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })()}

            {/* Leak Detail Dialog */}
            <Dialog open={!!selectedLeak} onOpenChange={(o) => !o && setSelectedLeak(null)}>
              <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
                {selectedLeak && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-severity-critical" />
                        {selectedLeak.organization}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={severityBg(selectedLeak.severity)}>{selectedLeak.severity}</Badge>
                        <Badge variant="outline" className={statusBg(selectedLeak.status)}>{selectedLeak.status.replace("_", " ")}</Badge>
                        <Badge variant="outline" className="border-border text-muted-foreground">{selectedLeak.sector}</Badge>
                        <Badge variant="outline" className="border-border text-muted-foreground">{selectedLeak.country}</Badge>
                      </div>
                      <p className="text-sm text-foreground">{selectedLeak.description}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border border-border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">Ransomware Group</p>
                          <p className="font-mono text-sm text-foreground">{selectedLeak.groupName}</p>
                        </div>
                        <div className="border border-border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">Est. Records</p>
                          <p className="font-mono text-sm text-foreground">{selectedLeak.estimatedRecords.toLocaleString()}</p>
                        </div>
                        <div className="border border-border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">Discovered</p>
                          <p className="font-mono text-sm text-foreground">{new Date(selectedLeak.discoveredDate).toLocaleString()}</p>
                        </div>
                        <div className="border border-border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">Published</p>
                          <p className="font-mono text-sm text-foreground">{new Date(selectedLeak.publishedDate).toLocaleString()}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Exposed Data Types</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedLeak.dataTypes.map((dt) => (
                            <Badge key={dt} variant="outline" className="border-primary/30 text-primary text-xs">{dt}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-primary/30 text-primary"
                        onClick={async () => {
                          if (!watchlist.includes(selectedLeak.organization)) {
                            await addWatchlistItem({ organization: selectedLeak.organization, notify_method: "email", notify_frequency: "instant" });
                            toast({ title: "Added to Watchlist", description: `Now watching ${selectedLeak.organization}` });
                          } else {
                            toast({ title: "Already watching", description: `${selectedLeak.organization} is on your watchlist` });
                          }
                        }}
                      >
                        <Bell className="h-4 w-4" /> Watch this Organization
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Live Post Detail Dialog */}
            <Dialog open={!!selectedLivePost} onOpenChange={(o) => !o && setSelectedLivePost(null)}>
              <DialogContent className="bg-card border-border max-w-2xl">
                {selectedLivePost && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-severity-high" />
                        {selectedLivePost.post_title || "Unknown Victim"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-primary/30 text-primary">{selectedLivePost.group_name}</Badge>
                        {selectedLivePost.discovered && (
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(selectedLivePost.discovered).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                      {selectedLivePost.description && (
                        <p className="text-sm text-foreground">{selectedLivePost.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border border-border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">Ransomware Group</p>
                          <p className="font-mono text-sm text-foreground">{selectedLivePost.group_name}</p>
                        </div>
                        <div className="border border-border rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1">Website</p>
                          <p className="font-mono text-sm text-foreground truncate">{selectedLivePost.website || "N/A"}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-primary/30 text-primary"
                        onClick={async () => {
                          const orgName = selectedLivePost.post_title || selectedLivePost.group_name;
                          if (!watchlist.includes(orgName)) {
                            await addWatchlistItem({ organization: orgName, notify_method: "email", notify_frequency: "instant" });
                            toast({ title: "Added to Watchlist", description: `Now watching ${orgName}` });
                          } else {
                            toast({ title: "Already watching", description: `${orgName} is on your watchlist` });
                          }
                        }}
                      >
                        <Bell className="h-4 w-4" /> Watch this Organization
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Group clicks now navigate to /group/:groupName */}
          </TabsContent>

          {/* ─── ANALYTICS TAB ─── */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Leak Trend */}
            <div className="border border-border rounded-md bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" /> Monthly Leak Trend
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyLeakTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,18%)" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(215,15%,50%)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(215,15%,50%)", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="leaks" name="Leaks" stroke="hsl(175,80%,45%)" fill="hsl(175,80%,45%)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="records" name="Records (M)" stroke="hsl(25,95%,53%)" fill="hsl(25,95%,53%)" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Severity Distribution */}
              <div className="border border-border rounded-md bg-card p-6">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-severity-critical" /> Severity Distribution
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={severityDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {severityDist.map((entry) => (
                          <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || "hsl(215,20%,50%)"} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sector Breakdown */}
              <div className="border border-border rounded-md bg-card p-6">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Globe className="h-4 w-4 text-primary" /> Sector Breakdown
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,18%)" />
                      <XAxis type="number" tick={{ fill: "hsl(215,15%,50%)", fontSize: 11 }} />
                      <YAxis type="category" dataKey="sector" width={100} tick={{ fill: "hsl(215,15%,50%)", fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Incidents" radius={[0, 4, 4, 0]}>
                        {sectorBreakdown.map((_, i) => (
                          <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Group Activity */}
            <div className="border border-border rounded-md bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-primary" /> Ransomware Group Activity
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,18%)" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(215,15%,50%)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "hsl(215,15%,50%)", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215,15%,50%)" }} />
                    <Bar dataKey="victims30d" name="30-day" fill="hsl(175,80%,45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="victims90d" name="90-day" fill="hsl(175,80%,45%)" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* ─── WATCHLIST TAB ─── */}
          <TabsContent value="watchlist" className="space-y-4">
            <div className="border border-border rounded-md bg-card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BellRing className="h-4 w-4 text-severity-medium" /> Your Watchlist
              </h3>
              {watchlist.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No organizations being watched</p>
                  <p className="text-xs mt-1">Click "Watch Organization" to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {watchlist.map((org) => {
                    const matchedLeaks = mockLeaks.filter((l) => l.organization.toLowerCase().includes(org.toLowerCase()));
                    return (
                      <div key={org} className="flex items-center justify-between p-3 rounded-md border border-border bg-background">
                        <div>
                          <p className="text-sm font-medium text-foreground">{org}</p>
                          <p className="text-xs text-muted-foreground">
                            {matchedLeaks.length > 0 ? `${matchedLeaks.length} known leak(s)` : "No known leaks"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {matchedLeaks.length > 0 && (
                            <Badge variant="outline" className="bg-severity-critical/10 text-severity-critical border-severity-critical/20 text-xs">
                              {matchedLeaks.length} leak(s)
                            </Badge>
                          )}
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-severity-critical" onClick={() => removeFromWatchlist(org)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notification Settings</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Instant Alerts</Label>
                    <p className="text-xs text-muted-foreground">Get notified immediately on new leaks</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Daily Summary</Label>
                    <p className="text-xs text-muted-foreground">Receive a daily digest of all activity</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Weekly Report</Label>
                    <p className="text-xs text-muted-foreground">Weekly ransomware landscape summary</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
