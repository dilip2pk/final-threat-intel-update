import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Search, Eye, Bell, BellRing, Shield, TrendingUp, Database, Globe, Calendar,
  AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Info, Loader2, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRansomLookAPI, type RansomLookPost } from "@/hooks/useRansomLookAPI";
import { useWatchlist } from "@/hooks/useSettings";

const ITEMS_PER_PAGE = 8;

export default function RansomLook() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loading: apiLoading, error: apiError, searchPosts, fetchRecentPosts } = useRansomLookAPI();
  const { items: watchlistItems, addItem: addWatchlistItem, removeItem: removeWatchlistItem } = useWatchlist();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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
    if (!search.trim()) {
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
  }, [search, searchPosts]);

  const sectors = useMemo(() => [...new Set(livePosts.map((p) => p.activity))].filter(Boolean).sort(), [livePosts]);

  const filteredLive = useMemo(() => {
    return livePosts.filter((p) => {
      if (sectorFilter !== "all" && p.activity !== sectorFilter) return false;
      return true;
    });
  }, [livePosts, sectorFilter]);

  const displayPosts = liveSearchResults ?? filteredLive;
  const totalPages = Math.ceil(displayPosts.length / ITEMS_PER_PAGE);
  const paginatedLive = displayPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalRecords = livePosts.length;

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Leaks", value: livePosts.length, icon: Database, color: "text-primary" },
            { label: "Groups Tracked", value: new Set(livePosts.map(p => p.group_name)).size, icon: Shield, color: "text-primary" },
            { label: "Watching", value: watchlist.length, icon: BellRing, color: "text-severity-medium" },
            { label: "Live Data", value: "✓", icon: Zap, color: "text-severity-low" },
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                Live Data Only
                {apiLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {apiError && <span className="text-xs text-severity-critical">API error — showing cached data</span>}
              </div>
            </div>

            {/* Leak Table */}
            <div className="border border-border rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      {["Victim / Organization", "Group", "Discovered", "Website", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedLive.map((post, idx) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {displayPosts.length === 0 && !apiLoading && (
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
                    const matchedLeaks = livePosts.filter((p) => 
                      p.post_title?.toLowerCase().includes(org.toLowerCase()) ||
                      p.group_name.toLowerCase().includes(org.toLowerCase())
                    );
                    return (
                      <div key={org} className="flex items-center justify-between p-3 rounded-md border border-border bg-background">
                        <div>
                          <p className="text-sm font-medium text-foreground">{org}</p>
                          <p className="text-xs text-muted-foreground">
                            {matchedLeaks.length === 0 && "No leaks found"}
                            {matchedLeaks.length === 1 && "1 potential leak"}
                            {matchedLeaks.length > 1 && `${matchedLeaks.length} potential leaks`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFromWatchlist(org)} className="text-severity-critical hover:text-severity-critical">
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
