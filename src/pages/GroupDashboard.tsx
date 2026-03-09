import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Globe, Shield, MapPin, Link2, Mail, MessageSquare, Eye, Download,
  Activity, TrendingUp, Loader2, ExternalLink, CheckCircle2, XCircle, Camera,
  Calendar, Clock, Bitcoin,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line,
} from "recharts";
import { useRansomLookAPI, type RansomLookGroup, type RansomLookPost } from "@/hooks/useRansomLookAPI";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function GroupDashboard() {
  const { groupName } = useParams<{ groupName: string }>();
  const navigate = useNavigate();
  const { fetchGroupInfo, fetchLastDays } = useRansomLookAPI();
  const [group, setGroup] = useState<RansomLookGroup | null>(null);
  const [posts, setPosts] = useState<RansomLookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsingEnabled, setParsingEnabled] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30d");
  const [descExpanded, setDescExpanded] = useState(false);
  const [chartAgg, setChartAgg] = useState<"daily" | "weekly" | "monthly">("weekly");

  const decodedName = decodeURIComponent(groupName || "");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [groupData, allPosts] = await Promise.all([
        fetchGroupInfo(decodedName),
        fetchLastDays(730),
      ]);
      setGroup(groupData);
      setPosts(allPosts.filter(p => p.group_name.toLowerCase() === decodedName.toLowerCase()));
      setLoading(false);
    }
    if (decodedName) load();
  }, [decodedName, fetchGroupInfo, fetchLastDays]);

  // Generate activity chart data from posts
  const activityData = useMemo(() => {
    if (!posts.length) return [];
    const sorted = [...posts].sort((a, b) => new Date(a.discovered).getTime() - new Date(b.discovered).getTime());
    const buckets: Record<string, number> = {};

    sorted.forEach(p => {
      if (!p.discovered) return;
      const d = new Date(p.discovered);
      let key: string;
      if (chartAgg === "daily") {
        key = d.toISOString().split("T")[0];
      } else if (chartAgg === "weekly") {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = `W${weekStart.toISOString().split("T")[0]}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      buckets[key] = (buckets[key] || 0) + 1;
    });

    return Object.entries(buckets).map(([date, count]) => ({
      date: date.replace(/^W/, ""),
      victims: count,
    }));
  }, [posts, chartAgg]);

  // Rolling average
  const withRollingAvg = useMemo(() => {
    return activityData.map((item, i) => {
      const window = activityData.slice(Math.max(0, i - 2), i + 1);
      const avg = window.reduce((s, w) => s + w.victims, 0) / window.length;
      return { ...item, rollingAvg: Math.round(avg * 10) / 10 };
    });
  }, [activityData]);

  const exportCSV = (type: "urls" | "posts") => {
    let csv: string;
    if (type === "urls" && group?.locations) {
      csv = "URL,Status,Title\n" + group.locations.map(l => `${l.fqdn},${l.available ? "Up" : "Down"},${l.title || ""}`).join("\n");
    } else {
      csv = "Victim,Discovered,Website\n" + posts.map(p => `"${p.post_title}",${p.discovered},${p.website || ""}`).join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${decodedName}-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading group intelligence...</span>
        </div>
      </AppLayout>
    );
  }

  const onlineCount = group?.locations?.filter(l => l.available).length || 0;
  const totalLocs = group?.locations?.length || 0;
  const healthPct = totalLocs > 0 ? Math.round((onlineCount / totalLocs) * 100) : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/ransomlook")} className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to RansomLook
        </Button>

        {/* ─── HEADER SECTION ─── */}
        <div className="border border-border rounded-lg bg-card p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground font-mono">{decodedName}</h1>
                <Badge variant="outline" className="bg-severity-critical/15 text-severity-critical border-severity-critical/30 text-xs">
                  RaaS
                </Badge>
                <Badge variant="outline" className={`text-xs ${onlineCount > 0 ? "bg-severity-low/15 text-severity-low border-severity-low/30" : "bg-muted text-muted-foreground border-border"}`}>
                  {onlineCount > 0 ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> {posts.length} victims</span>
                <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {totalLocs} known URLs</span>
                <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> {healthPct}% uptime</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 mr-3">
                <span className="text-xs text-muted-foreground">Parsing</span>
                <Switch checked={parsingEnabled} onCheckedChange={setParsingEnabled} />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCSV("urls")}>
                <Download className="h-3.5 w-3.5" /> Export URLs
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCSV("posts")}>
                <Download className="h-3.5 w-3.5" /> Export Posts
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Bitcoin className="h-3.5 w-3.5" /> View Crypto
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="up">Up</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7d</SelectItem>
                  <SelectItem value="30d">Last 30d</SelectItem>
                  <SelectItem value="90d">Last 90d</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ─── GROUP DETAILS SECTION ─── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border border-border rounded-lg bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Group Details
            </h2>
            {group?.profile && group.profile.length > 0 && (
              <Collapsible open={descExpanded} onOpenChange={setDescExpanded}>
                <CollapsibleTrigger className="text-xs text-primary hover:underline cursor-pointer">
                  {descExpanded ? "Hide" : "Show"} Description
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-background rounded-md p-4 border border-border">
                    {group.profile.map((line, i) => (
                      <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            {group?.meta && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Meta</p>
                <p className="text-sm text-foreground">{group.meta}</p>
              </div>
            )}
            {!group?.profile?.length && !group?.meta && (
              <p className="text-sm text-muted-foreground italic">No detailed profile available.</p>
            )}
          </div>

          <div className="border border-border rounded-lg bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Communication Channels
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Contact Emails</p>
                <p className="text-sm text-foreground font-mono">Not publicly available</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Tox IDs</p>
                <p className="text-sm text-foreground font-mono">Check group profile for details</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Globe className="h-3 w-3" /> Known Channels</p>
                <p className="text-sm text-foreground">Tor leak site, Telegram (if applicable)</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── INFRASTRUCTURE MONITORING TABLE ─── */}
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Infrastructure Monitoring
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{totalLocs} known locations · {onlineCount} online</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-y border-border">
                <tr>
                  {["URL", "Status", "Screenshot", "Uptime (30d)", "Health", "Last Checked"].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(group?.locations || [])
                  .filter(loc => statusFilter === "all" || (statusFilter === "up" && loc.available) || (statusFilter === "down" && !loc.available))
                  .map((loc, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs text-foreground truncate max-w-[300px]">{loc.fqdn}</span>
                      </div>
                      {loc.title && <p className="text-[11px] text-muted-foreground mt-0.5 pl-5">{loc.title}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`text-[10px] ${loc.available
                        ? "bg-severity-low/15 text-severity-low border-severity-low/30"
                        : "bg-severity-critical/15 text-severity-critical border-severity-critical/30"
                      }`}>
                        {loc.available ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Up</> : <><XCircle className="h-3 w-3 mr-1" /> Down</>}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <Camera className="h-3 w-3" /> Capture
                      </Button>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-foreground">30d</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${loc.available ? "bg-severity-low" : "bg-severity-critical"}`} style={{ width: `${loc.available ? 95 : 15}%` }} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{loc.available ? "95%" : "15%"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date().toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(!group?.locations || group.locations.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No infrastructure data available</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── ACTIVITY CHARTS ─── */}
        <div className="border border-border rounded-lg bg-card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Victim Activity Timeline
            </h2>
            <div className="flex items-center gap-2">
              {(["daily", "weekly", "monthly"] as const).map(agg => (
                <Button key={agg} variant={chartAgg === agg ? "default" : "outline"} size="sm" className="h-7 text-xs capitalize" onClick={() => setChartAgg(agg)}>
                  {agg}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                // Export chart as text data
                const csv = "Date,Victims,RollingAvg\n" + withRollingAvg.map(d => `${d.date},${d.victims},${d.rollingAvg}`).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${decodedName}-activity.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>
          </div>
          {withRollingAvg.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={withRollingAvg}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="victims" name="Victims" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                  <Line type="monotone" dataKey="rollingAvg" name="Rolling Avg" stroke="hsl(25, 95%, 53%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity data available for this group</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
