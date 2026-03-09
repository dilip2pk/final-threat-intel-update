import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeedSources } from "@/hooks/useFeedSources";
import { useRSSFeeds, type RSSFeedItem, type RSSSource } from "@/hooks/useRSSFeeds";
import { useAutoFetchFeeds } from "@/hooks/useAutoFetchFeeds";
import { Search, Shield, AlertTriangle, Rss, Activity, Loader2, Clock, Brain, Plus, TrendingUp, RefreshCw } from "lucide-react";
import { TopCVEsWidget } from "@/components/TopCVEsWidget";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardFeedCard } from "@/components/dashboard/DashboardFeedCard";
import { DashboardPagination } from "@/components/dashboard/DashboardPagination";

const ITEMS_PER_PAGE = 10;

const Index = () => {
  const navigate = useNavigate();
  const { sources: configuredSources, loading: sourcesLoading } = useFeedSources();
  const { loading, error, fetchAllFeeds } = useRSSFeeds();
  const [sources, setSources] = useState<RSSSource[]>([]);
  const [items, setItems] = useState<RSSFeedItem[]>([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasConfiguredSources = configuredSources.filter(s => s.active).length > 0;

  const loadFeeds = async () => {
    const { sources: s, items: i } = await fetchAllFeeds();
    setSources(s);
    setItems(i);
  };

  useEffect(() => {
    if (sourcesLoading) return;
    if (!hasConfiguredSources) {
      setInitialLoaded(true);
      return;
    }
    loadFeeds().then(() => setInitialLoaded(true));
  }, [fetchAllFeeds, sourcesLoading, hasConfiguredSources]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeeds();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (sourceFilter !== "all" && item.feedId !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, search, sourceFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const stats = {
    activeFeeds: sources.filter(s => s.active).length,
    totalArticles: items.length,
    totalSources: sources.length,
    errors: sources.filter(s => !s.active).length,
  };

  if (!initialLoaded) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Loading Dashboard</p>
            <p className="text-xs text-muted-foreground mt-1">Fetching threat intelligence feeds...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!hasConfiguredSources) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Threat Intelligence Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Live security feeds from trusted sources</p>
          </div>
          <div className="flex flex-col items-center justify-center py-20 space-y-5 border border-dashed border-border rounded-xl bg-card/50">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Rss className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">No Feed Sources Configured</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Add RSS feed sources to start ingesting threat intelligence data. The dashboard will display live data from your configured sources.
              </p>
            </div>
            <Button onClick={() => navigate("/feeds")} className="gap-2 mt-2">
              <Plus className="h-4 w-4" /> Configure Feed Sources
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Threat Intelligence</h1>
            </div>
            <p className="text-xs text-muted-foreground ml-[42px]">Real-time security feeds from {stats.totalSources} configured sources</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <DashboardStats
          activeFeeds={stats.activeFeeds}
          totalArticles={stats.totalArticles}
          totalSources={stats.totalSources}
          errors={stats.errors}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles by title or description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 bg-card border-border h-9 text-sm"
            />
          </div>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48 bg-card border-border h-9 text-sm">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-severity-high p-3 rounded-lg bg-severity-high/5 border border-severity-high/20">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Some feeds could not be fetched. Showing available data.</span>
          </div>
        )}

        {/* Feed Grid + Top CVEs */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-3">
            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filtered.length > 0 ? (
                  <>Showing <span className="font-mono text-foreground">{(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-mono text-foreground">{filtered.length}</span> articles</>
                ) : (
                  "No articles found"
                )}
              </p>
            </div>

            {/* Feed cards */}
            <div className="grid md:grid-cols-2 gap-3">
              {paginated.map((item, idx) => (
                <DashboardFeedCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  onClick={() => navigate(`/feed/${encodeURIComponent(item.id)}`, { state: { feedItem: item } })}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card/30">
                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground">No articles match your filters</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or source filter</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>

          {/* Top CVEs - desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <TopCVEsWidget />
            </div>
          </div>
        </div>

        {/* Top CVEs - mobile */}
        <div className="lg:hidden">
          <TopCVEsWidget />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
