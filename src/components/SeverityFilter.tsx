import { Badge } from "@/components/ui/badge";
import { type Severity, getSeverityBg } from "@/lib/mockData";

const severities: (Severity | "all")[] = ["all", "critical", "high", "medium", "low", "info"];

interface SeverityFilterProps {
  selected: Severity | "all";
  onChange: (s: Severity | "all") => void;
}

export function SeverityFilter({ selected, onChange }: SeverityFilterProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {severities.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors uppercase ${
            selected === s
              ? s === "all"
                ? "bg-primary/15 text-primary border-primary/30"
                : getSeverityBg(s as Severity)
              : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/30"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
