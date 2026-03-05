import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeedSources } from "@/hooks/useFeedSources";
import { useRSSFeeds, type RSSFeedItem, type RSSSource } from "@/hooks/useRSSFeeds";
import { Search, Shield, AlertTriangle, Rss, Activity, Loader2, Clock, Brain, Plus } from "lucide-react";
import { TopCVEsWidget } from "@/components/TopCVEsWidget";

const ITEMS_PER_PAGE = 9;

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

  const hasConfiguredSources = configuredSources.filter(s => s.active).length > 0;

  useEffect(() => {
    if (sourcesLoading) return;
    if (!hasConfiguredSources) {
      setInitialLoaded(true);
      return;
    }
    fetchAllFeeds().then(({ sources: s, items: i }) => {
      setSources(s);
      setItems(i);
      setInitialLoaded(true);
    });
  }, [fetchAllFeeds, sourcesLoading, hasConfiguredSources]);

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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  const stats = [
    { label: "Active Feeds", value: sources.filter(s => s.active).length, icon: Rss, color: "text-primary" },
    { label: "Total Articles", value: items.length, icon: Activity, color: "text-primary" },
    { label: "Sources", value: sources.length, icon: Shield, color: "text-severity-medium" },
    { label: "Errors", value: sources.filter(s => !s.active).length, icon: AlertTriangle, color: "text-severity-critical" },
  ];

  const maxVisiblePages = 5;
  const getPageNumbers = () => {
    if (totalPages <= maxVisiblePages) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    const end = Math.min(totalPages, start + maxVisiblePages - 1);
    const adjusted = Math.max(1, end - maxVisiblePages + 1);
    return Array.from({ length: end - adjusted + 1 }, (_, i) => adjusted + i);
  };

  if (!initialLoaded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading threat feeds...</span>
        </div>
      </AppLayout>
    );
  }

  if (!hasConfiguredSources) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Threat Intelligence Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Live security feeds from trusted sources</p>
          </div>
          <div className="flex flex-col items-center justify-center py-20 space-y-4 border border-dashed border-border rounded-lg bg-card/50">
            <Rss className="h-16 w-16 text-muted-foreground/20" />
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
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Threat Intelligence Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Live security feeds from configured sources</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="border border-border rounded-md bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <span className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full md:w-48 bg-card border-border">
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
          <div className="flex items-center gap-2 text-xs text-severity-high p-2 rounded bg-severity-high/10 border border-severity-high/20">
            <AlertTriangle className="h-3.5 w-3.5" />
            Some feeds could not be fetched. Showing available data.
          </div>
        )}

        {/* Feed Grid + Top CVEs */}
        <div className="grid xl:grid-cols-[1fr_300px] gap-4">
          <div className="grid md:grid-cols-2 gap-3">
          {paginated.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              onClick={() => navigate(`/feed/${encodeURIComponent(item.id)}`, { state: { feedItem: item } })}
              className="group cursor-pointer border border-border rounded-md bg-card p-4 hover:border-primary/40 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                  {item.title}
                </h3>
                <Brain className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{item.description}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono text-primary/70">{item.feedName}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(item.pubDate)}
                </span>
              </div>
              {item.category && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{item.category}</Badge>
                </div>
              )}
            </div>
          ))}
          </div>
          <div className="hidden xl:block">
            <TopCVEsWidget />
          </div>
        </div>

        {/* Top CVEs mobile */}
        <div className="xl:hidden">
          <TopCVEsWidget />
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No articles match your filters</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              ‹
            </button>
            {getPageNumbers()[0] > 1 && (
              <>
                <button onClick={() => setPage(1)} className="px-3 py-1.5 text-xs font-mono rounded-md border border-border text-muted-foreground hover:border-muted-foreground/30 transition-colors">1</button>
                {getPageNumbers()[0] > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
              </>
            )}
            {getPageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                  page === p
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-border hover:border-muted-foreground/30"
                }`}
              >
                {p}
              </button>
            ))}
            {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
              <>
                {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                <button onClick={() => setPage(totalPages)} className="px-3 py-1.5 text-xs font-mono rounded-md border border-border text-muted-foreground hover:border-muted-foreground/30 transition-colors">{totalPages}</button>
              </>
            )}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
