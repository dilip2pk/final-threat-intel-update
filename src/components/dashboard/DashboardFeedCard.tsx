import { Badge } from "@/components/ui/badge";
import { Clock, Brain } from "lucide-react";
import type { RSSFeedItem } from "@/hooks/useRSSFeeds";

interface DashboardFeedCardProps {
  item: RSSFeedItem;
  onClick: () => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
};

export function DashboardFeedCard({ item, onClick }: DashboardFeedCardProps) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer border border-border rounded-xl bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1 leading-snug">
          {item.title}
        </h3>
        <div className="h-7 w-7 rounded-lg bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
          <Brain className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{item.description}</p>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <Badge variant="outline" className="text-[10px] font-mono border-primary/20 text-primary/80 bg-primary/5 px-2 py-0.5">
          {item.feedName}
        </Badge>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDate(item.pubDate)}
        </span>
      </div>
      {item.category && (
        <div className="mt-2.5 pt-2.5 border-t border-border/50">
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{item.category}</Badge>
        </div>
      )}
    </div>
  );
}
