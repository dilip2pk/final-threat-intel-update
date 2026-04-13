import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Eye, Bell, BellRing, Shield, TrendingUp, Database, Globe, Calendar,
  AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Info, Loader2, Zap,
  Skull, Activity, Users, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRansomLookAPI, type RansomLookPost } from "@/hooks/useRansomLookAPI";
import { useWatchlist } from "@/hooks/useSettings";

const ITEMS_PER_PAGE = 10;

export default function RansomLook() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loading: apiLoading, error: apiError, searchPosts, fetchLastDays } = useRansomLookAPI();
  const { items: watchlistItems, addItem: addWatchlistItem, removeItem: removeWatchlistItem } = useWatchlist();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  
  const [watchDialogOpen, setWatchDialogOpen] = useState(false);
  const [watchOrg, setWatchOrg] = useState("");
  const [notifyMethod, setNotifyMethod] = useState("email");
  const [notifyFreq, setNotifyFreq] = useState("instant");
  const [livePosts, setLivePosts] = useState<RansomLookPost[]>([]);
  const [liveSearchResults, setLiveSearchResults] = useState<RansomLookPost[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const watchlist = watchlistItems.map(w => w.organization);

  useEffect(() => {
    fetchLastDays(730).then((posts) => {
      if (posts.length > 0) setLivePosts(posts);
      setInitialLoading(false);
    });
  }, [fetchLastDays]);

  const handleGroupClick = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/group/${encodeURIComponent(groupName)}`);
  };

  useEffect(() => {
    if (!search.trim()) {
      setLiveSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      searchPosts(search, 730).then((results) => {
        setLiveSearchResults(results);
        setPage(1);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [search, searchPosts]);

  const displayPosts = liveSearchResults ?? livePosts;
  const totalPages = Math.ceil(displayPosts.length / ITEMS_PER_PAGE);
  const paginatedLive = displayPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const uniqueGroups = useMemo(() => new Set(livePosts.map(p => p.group_name)).size, [livePosts]);

  const addToWatchlist = async () => {
    if (!watchOrg.trim()) return;
    if (watchlist.includes(watchOrg.trim())) {
      toast({ title: "Already watching", description: `${watchOrg} is already on your watchlist` });
      return;
    }
    await addWatchlistItem({ organization: watchOrg.trim(), notify_method: notifyMethod, notify_frequency: notifyFreq });
    toast({ title: "Organization Added", description: `Now watching "${watchOrg}".` });
    setWatchOrg("");
    setWatchDialogOpen(false);
  };

  const removeFromWatchlist = async (org: string) => {
    const item = watchlistItems.find(w => w.organization === org);
    if (item) await removeWatchlistItem(item.id);
    toast({ title: "Removed", description: `${org} removed from watchlist` });
  };

  const stats = [
    { label: "Total Leaks", value: livePosts.length, icon: Database, color: "text-severity-critical" },
    { label: "Active Groups", value: uniqueGroups, icon: Users, color: "text-severity-high" },
    { label: "Watching", value: watchlist.length, icon: BellRing, color: "text-primary" },
    { label: "Data Source", value: "LIVE", icon: Activity, color: "text-severity-low" },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-severity-critical/5 via-transparent to-primary/5" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-severity-critical/10 border border-severity-critical/20">
                <Skull className="h-6 w-6 text-severity-critical" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                  RansomLook Intelligence
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Real-time ransomware leak monitoring & threat intelligence
                </p>
              </div>
            </div>
            <Dialog open={watchDialogOpen} onOpenChange={setWatchDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                  <BellRing className="h-4 w-4" /> Watch Organization
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-foreground flex items-center gap-2">
                    <BellRing className="h-5 w-5 text-primary" />
                    Watch an Organization
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Organization Name</Label>
                    <Input value={watchOrg} onChange={(e) => setWatchOrg(e.target.value)} placeholder="e.g. Acme Healthcare" className="bg-background border-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notification</Label>
                      <Select value={notifyMethod} onValueChange={setNotifyMethod}>
                        <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="slack">Slack</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Frequency</Label>
                      <Select value={notifyFreq} onValueChange={setNotifyFreq}>
                        <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">Instant</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-severity-medium/10 border border-severity-medium/20">
                    <Info className="h-4 w-4 text-severity-medium shrink-0" />
                    <p className="text-xs text-severity-medium">Email/Slack delivery requires Lovable Cloud.</p>
                  </div>
                  <Button onClick={addToWatchlist} className="w-full gap-2">
                    <Bell className="h-4 w-4" /> Add to Watchlist
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="border-border bg-card hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className={`text-2xl font-bold font-mono mt-1 ${s.color}`}>
                      {initialLoading ? <Skeleton className="h-7 w-16" /> : s.value}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color} bg-current/10`} style={{ backgroundColor: 'transparent' }}>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="search" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted border border-border">
              <TabsTrigger value="search" className="gap-1.5 data-[state=active]:bg-card">
                <Search className="h-3.5 w-3.5" /> Leaks Feed
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="gap-1.5 data-[state=active]:bg-card">
                <BellRing className="h-3.5 w-3.5" /> Watchlist
                {watchlist.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-[10px] px-1.5">
                    {watchlist.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              {apiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {apiError ? (
                <span className="text-severity-critical flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> API Error
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-severity-low animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>

          {/* ─── SEARCH & LEAKS TAB ─── */}
          <TabsContent value="search" className="space-y-4 mt-0">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search victim, group, or domain (e.g. aptean.com)..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 h-11 bg-card border-border text-sm"
              />
              {apiLoading && search && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
              )}
            </div>

            {/* Results info */}
            {search && liveSearchResults !== null && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <span className="font-mono">{displayPosts.length}</span> results for
                <Badge variant="outline" className="font-mono text-[11px] border-primary/30 text-primary">
                  {search}
                </Badge>
              </div>
            )}

            {/* Leak Table */}
            <Card className="border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider w-[35%]">Victim / Organization</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider w-[20%]">Threat Group</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider w-[15%]">Discovered</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider w-[25%]">Website</TableHead>
                      <TableHead className="w-[5%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        </TableRow>
                      ))
                    ) : paginatedLive.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32">
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Shield className="h-10 w-10 mb-2 opacity-20" />
                            <p className="text-sm font-medium">No leaks found</p>
                            <p className="text-xs mt-0.5">Try a different search term</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedLive.map((post, idx) => {
                        const isWatched = watchlist.some(w =>
                          post.post_title?.toLowerCase().includes(w.toLowerCase()) ||
                          post.group_name.toLowerCase().includes(w.toLowerCase())
                        );
                        return (
                          <TableRow
                            key={`${post.group_name}-${post.post_title}-${idx}`}
                            className="cursor-pointer group"
                            onClick={() => navigate(`/ransomlook/victim/${encodeURIComponent(post.post_title || post.group_name)}`)}
                          >
                            <TableCell className="font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                {isWatched && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-severity-critical shrink-0 animate-pulse-glow" />
                                )}
                                <span className="truncate max-w-[300px]">{post.post_title || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={(e) => handleGroupClick(post.group_name, e)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-severity-critical/8 hover:bg-severity-critical/15 text-severity-critical font-mono text-xs font-medium transition-colors"
                              >
                                <Skull className="h-3 w-3" />
                                {post.group_name}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs font-mono">
                              {post.discovered ? new Date(post.discovered).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              <span className="truncate block max-w-[200px]">{post.website || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Showing <span className="font-mono font-medium text-foreground">{(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, displayPosts.length)}</span> of <span className="font-mono font-medium text-foreground">{displayPosts.length}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {pages[0] > 1 && (
                      <>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 font-mono text-xs" onClick={() => setPage(1)}>1</Button>
                        {pages[0] > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
                      </>
                    )}
                    {pages.map((p) => (
                      <Button
                        key={p}
                        variant={page === p ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0 font-mono text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    {pages[pages.length - 1] < totalPages && (
                      <>
                        {pages[pages.length - 1] < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 font-mono text-xs" onClick={() => setPage(totalPages)}>{totalPages}</Button>
                      </>
                    )}
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}

          </TabsContent>

          {/* ─── WATCHLIST TAB ─── */}
          <TabsContent value="watchlist" className="space-y-4 mt-0">
            <Card className="border-border">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-primary" /> Your Watchlist
                  </h3>
                  <span className="text-xs text-muted-foreground">{watchlist.length} organization{watchlist.length !== 1 ? 's' : ''}</span>
                </div>
                {watchlist.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Bell className="h-7 w-7 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">No organizations being watched</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">Click "Watch Organization" to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {watchlist.map((org) => {
                      const matchedLeaks = livePosts.filter((p) =>
                        p.post_title?.toLowerCase().includes(org.toLowerCase()) ||
                        p.group_name.toLowerCase().includes(org.toLowerCase())
                      );
                      return (
                         <div
                          key={org}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:border-primary/20 transition-colors cursor-pointer"
                          onClick={() => navigate(`/ransomlook/victim/${encodeURIComponent(org)}`)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${matchedLeaks.length > 0 ? 'bg-severity-critical/10' : 'bg-muted'}`}>
                              <Eye className={`h-4 w-4 ${matchedLeaks.length > 0 ? 'text-severity-critical' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{org}</p>
                              <p className="text-xs text-muted-foreground">
                                {matchedLeaks.length === 0 && "No leaks found — clean"}
                                {matchedLeaks.length === 1 && (
                                  <span className="text-severity-critical font-medium">⚠ 1 potential leak detected</span>
                                )}
                                {matchedLeaks.length > 1 && (
                                  <span className="text-severity-critical font-medium">⚠ {matchedLeaks.length} potential leaks detected</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-severity-critical" onClick={(e) => { e.stopPropagation(); removeFromWatchlist(org); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
