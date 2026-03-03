import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRSSFeeds, type RSSSource, type RSSFeedItem } from "@/hooks/useRSSFeeds";
import { Search, ArrowLeft, Rss, Activity, ChevronRight, Loader2, ExternalLink, Clock, AlertTriangle } from "lucide-react";

const ITEMS_PER_PAGE = 9;

export default function SourcesView() {
  const { loading, error, fetchAllFeeds, fetchSingleFeed } = useRSSFeeds();
  const [sources, setSources] = useState<RSSSource[]>([]);
  const [allItems, setAllItems] = useState<RSSFeedItem[]>([]);
  const [selectedSource, setSelectedSource] = useState<RSSSource | null>(null);
  const [sourceItems, setSourceItems] = useState<RSSFeedItem[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Fetch all feeds on mount
  useEffect(() => {
    fetchAllFeeds().then(({ sources: s, items }) => {
      setSources(s);
      setAllItems(items);
      setInitialLoaded(true);
    });
  }, [fetchAllFeeds]);

  // When selecting a source, filter items from the already-fetched data
  const handleSelectSource = (source: RSSSource) => {
    setSelectedSource(source);
    setPage(1);
    setSearch("");
    const items = allItems.filter(i => i.feedId === source.id);
    setSourceItems(items);
  };

  const filtered = useMemo(() => {
    if (!selectedSource) return [];
    let items = sourceItems;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(f => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
    }
    return items;
  }, [selectedSource, sourceItems, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  if (!initialLoaded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Fetching live RSS feeds...</span>
        </div>
      </AppLayout>
    );
  }

  if (selectedSource) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedSource(null); setSearch(""); setPage(1); }} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> All Sources
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Rss className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{selectedSource.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{selectedSource.url}</p>
            </div>
            <Badge variant="outline" className={`ml-auto text-xs ${selectedSource.active ? "border-primary/30 text-primary" : "border-muted-foreground/30 text-muted-foreground"}`}>
              {selectedSource.active ? "Active" : "Error"}
            </Badge>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search articles..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 bg-card border-border" />
          </div>

          {/* Articles */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paginated.map((item, idx) => (
              <a
                key={`${item.id}-${idx}`}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-border rounded-md bg-card p-4 hover:border-primary/40 transition-all"
              >
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{item.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {item.category && <Badge variant="outline" className="text-xs border-border">{item.category}</Badge>}
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {formatDate(item.pubDate)}
                  </span>
                </div>
              </a>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Rss className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No articles found</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${page === i + 1 ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-border hover:border-muted-foreground/30"}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">RSS Sources</h1>
            <p className="text-sm text-muted-foreground mt-1">Live feeds from security intelligence sources</p>
          </div>
          {error && (
            <Badge variant="outline" className="border-severity-high/30 text-severity-high gap-1">
              <AlertTriangle className="h-3 w-3" /> Some feeds failed
            </Badge>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sources.map(source => (
            <button
              key={source.id}
              onClick={() => handleSelectSource(source)}
              className="border border-border rounded-md bg-card p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <Rss className="h-4 w-4 text-primary" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{source.name}</h3>
              <p className="text-xs text-muted-foreground font-mono truncate mb-3">{source.url}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" /> {source.itemCount} articles
                </span>
                <span>•</span>
                <span>{source.category}</span>
              </div>
              <div className="mt-2 flex gap-1.5 flex-wrap">
                <Badge variant="outline" className={`text-xs ${source.active ? "border-primary/30 text-primary" : "border-severity-high/30 text-severity-high"}`}>
                  {source.active ? "Active" : "Error"}
                </Badge>
                {source.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs border-border text-muted-foreground">{tag}</Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
