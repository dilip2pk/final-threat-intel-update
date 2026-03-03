import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRSSFeeds, type RSSFeedItem, type RSSSource } from "@/hooks/useRSSFeeds";
import { Search, Shield, AlertTriangle, Rss, Activity, Loader2, Clock, ExternalLink, ShieldAlert, Brain } from "lucide-react";

const ITEMS_PER_PAGE = 9;

const Index = () => {
  const navigate = useNavigate();
  const { loading, error, fetchAllFeeds } = useRSSFeeds();
  const [sources, setSources] = useState<RSSSource[]>([]);
  const [items, setItems] = useState<RSSFeedItem[]>([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    fetchAllFeeds().then(({ sources: s, items: i }) => {
      setSources(s);
      setItems(i);
      setInitialLoaded(true);
    });
  }, [fetchAllFeeds]);

  // Separate CVE items from regular feed items
  const cveItems = useMemo(() => {
    return items.filter((item) => item.feedId === "cvefeed_high" || item.feedId === "cvefeed_critical");
  }, [items]);

  const regularItems = useMemo(() => {
    return items.filter((item) => item.feedId !== "cvefeed_high" && item.feedId !== "cvefeed_critical");
  }, [items]);

  const filtered = useMemo(() => {
    return regularItems.filter((item) => {
      if (sourceFilter !== "all" && item.feedId !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [regularItems, search, sourceFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  const regularSources = sources.filter(s => s.id !== "cvefeed_high" && s.id !== "cvefeed_critical");

  const stats = [
    { label: "Active Feeds", value: regularSources.filter(s => s.active).length, icon: Rss, color: "text-primary" },
    { label: "Total Articles", value: regularItems.length, icon: Activity, color: "text-primary" },
    { label: "Sources", value: regularSources.length, icon: Shield, color: "text-severity-medium" },
    { label: "Errors", value: regularSources.filter(s => !s.active).length, icon: AlertTriangle, color: "text-severity-critical" },
  ];

  // Pagination helpers
  const maxVisiblePages = 5;
  const getPageNumbers = () => {
    if (totalPages <= maxVisiblePages) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    const end = Math.min(totalPages, start + maxVisiblePages - 1);
    const adjusted = Math.max(1, end - maxVisiblePages + 1);
    return Array.from({ length: end - adjusted + 1 }, (_, i) => adjusted + i);
  };

  const getSeverityFromTitle = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes("critical") || lower.includes("cvss 9") || lower.includes("cvss 10")) return "critical";
    return "high";
  };

  if (!initialLoaded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading live threat feeds...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Threat Intelligence Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Live security feeds from trusted sources</p>
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

        {/* Main Content: Feed Grid + CVE Panel */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Feed Grid */}
          <div className="flex-1 space-y-4 min-w-0">
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
                  {regularSources.map((s) => (
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

            {/* Feed Grid */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
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

          {/* Right: CVE Feed Panel */}
          <div className="lg:w-80 xl:w-96 shrink-0">
            <div className="border border-border rounded-md bg-card sticky top-6">
              <div className="p-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-severity-critical" />
                  Latest High & Critical CVEs
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Live from cvefeed.io · {cveItems.length} entries
                </p>
              </div>
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto divide-y divide-border">
                {cveItems.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No CVE data available</p>
                  </div>
                ) : (
                  cveItems.slice(0, 50).map((cve, idx) => {
                    const severity = cve.feedId === "cvefeed_critical" ? "critical" : getSeverityFromTitle(cve.title);
                    return (
                      <a
                        key={`${cve.id}-${idx}`}
                        href={cve.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 hover:bg-muted/20 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 capitalize ${
                              severity === "critical"
                                ? "bg-severity-critical/15 text-severity-critical border-severity-critical/30"
                                : "bg-severity-high/15 text-severity-high border-severity-high/30"
                            }`}
                          >
                            {severity}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                              {cve.title}
                            </p>
                            {cve.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{cve.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                              {formatDate(cve.pubDate)}
                            </p>
                          </div>
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
