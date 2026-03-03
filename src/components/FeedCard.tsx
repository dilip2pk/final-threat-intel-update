import { Badge } from "@/components/ui/badge";
import { type FeedItem, getSeverityBg, formatDate } from "@/lib/mockData";
import { Clock, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function FeedCard({ item }: { item: FeedItem }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/feed/${item.id}`)}
      className="group cursor-pointer border border-border rounded-md bg-card p-4 hover:border-primary/40 hover:glow-primary transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
          {item.title}
        </h3>
        {item.severity && (
          <Badge variant="outline" className={`${getSeverityBg(item.severity)} text-xs shrink-0 uppercase font-mono`}>
            {item.severity}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{item.description}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono text-primary/70">{item.sourceName}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDate(item.publishedDate)}
        </span>
      </div>
      {item.cves.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {item.cves.slice(0, 3).map((cve) => (
            <span key={cve} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {cve}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
