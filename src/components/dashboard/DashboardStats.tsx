import { Rss, Activity, Shield, AlertTriangle, TrendingUp } from "lucide-react";

interface DashboardStatsProps {
  activeFeeds: number;
  totalArticles: number;
  totalSources: number;
  errors: number;
}

export function DashboardStats({ activeFeeds, totalArticles, totalSources, errors }: DashboardStatsProps) {
  const stats = [
    {
      label: "Active Feeds",
      value: activeFeeds,
      icon: Rss,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total Articles",
      value: totalArticles,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Sources",
      value: totalSources,
      icon: Shield,
      color: "text-severity-medium",
      bg: "bg-severity-medium/10",
    },
    {
      label: "Errors",
      value: errors,
      icon: AlertTriangle,
      color: "text-severity-critical",
      bg: "bg-severity-critical/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="relative overflow-hidden border border-border rounded-xl bg-card p-4 transition-all hover:border-border/80 hover:shadow-sm group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-7 w-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
          </div>
          <span className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
