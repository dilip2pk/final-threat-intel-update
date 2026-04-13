import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Globe, Shield, Calendar, ExternalLink, Loader2,
  Skull, Building2, DollarSign, Link2, FileText, AlertTriangle,
  ChevronLeft, ChevronRight, Eye, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useRansomLookAPI, type RansomLookPost } from "@/hooks/useRansomLookAPI";

const POSTS_PER_PAGE = 15;

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

export default function VictimDetail() {
  const { victimName } = useParams<{ victimName: string }>();
  const navigate = useNavigate();
  const { fetchLastDays, loading: apiLoading } = useRansomLookAPI();
  const [posts, setPosts] = useState<RansomLookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const decodedName = decodeURIComponent(victimName || "");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const allPosts = await fetchLastDays(730);
      const matched = allPosts.filter(
        (p) =>
          p.post_title?.toLowerCase().includes(decodedName.toLowerCase()) ||
          p.group_name?.toLowerCase() === decodedName.toLowerCase()
      );
      // Sort newest first
      matched.sort((a, b) => new Date(b.discovered).getTime() - new Date(a.discovered).getTime());
      setPosts(matched);
      setLoading(false);
    }
    if (decodedName) load();
  }, [decodedName, fetchLastDays]);

  // Determine if this is a group or a victim
  const isGroup = useMemo(() => {
    if (!posts.length) return false;
    return posts.every((p) => p.group_name.toLowerCase() === decodedName.toLowerCase());
  }, [posts, decodedName]);

  // Unique groups that claimed this victim
  const claimingGroups = useMemo(() => {
    const groups = new Set(posts.map((p) => p.group_name));
    return Array.from(groups);
  }, [posts]);

  // Extract domain/website from posts
  const website = useMemo(() => {
    const w = posts.find((p) => p.website)?.website;
    return w || null;
  }, [posts]);

  // Determine activity status
  const status = useMemo(() => {
    if (!posts.length) return "unknown";
    const latest = new Date(posts[0].discovered);
    const daysSince = (Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) return "active";
    if (daysSince < 90) return "recent";
    return "inactive";
  }, [posts]);

  // Timeline chart data — monthly aggregation
  const timelineData = useMemo(() => {
    if (!posts.length) return [];
    const buckets: Record<string, number> = {};
    posts.forEach((p) => {
      if (!p.discovered) return;
      const d = new Date(p.discovered);
      const key = `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    // Sort chronologically
    const sorted = Object.entries(buckets).sort((a, b) => {
      const parseDate = (s: string) => new Date(s);
      return parseDate(a[0]).getTime() - parseDate(b[0]).getTime();
    });
    return sorted.map(([date, count]) => ({ date, posts: count }));
  }, [posts]);

  // Pagination
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  const paginatedPosts = posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  // First and last seen
  const firstSeen = posts.length ? posts[posts.length - 1].discovered : null;
  const lastSeen = posts.length ? posts[0].discovered : null;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading intelligence data...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        {/* Back + Browse */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/ransomlook")}
            className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/ransomlook")}
              className="gap-1.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" /> Browse Companies
            </Button>
          </div>
        </div>

        {/* ─── HEADER ─── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{decodedName}</h1>
            <div className="h-6 w-1.5 rounded-full bg-primary" />
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              status === "active"
                ? "bg-severity-low/15 text-severity-low border-severity-low/30"
                : status === "recent"
                ? "bg-severity-medium/15 text-severity-medium border-severity-medium/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {status}
          </Badge>
        </div>

        {/* ─── INFO BAR ─── */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Threat Groups
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {claimingGroups.map((g) => (
                    <button
                      key={g}
                      onClick={() => navigate(`/group/${encodeURIComponent(g)}`)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-severity-critical/10 text-severity-critical text-xs font-mono hover:bg-severity-critical/20 transition-colors"
                    >
                      <Skull className="h-3 w-3" />
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Website
                </p>
                <p className="text-sm font-medium text-foreground">
                  {website ? (
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  First Seen
                </p>
                <p className="text-sm font-medium text-foreground font-mono">
                  {firstSeen ? new Date(firstSeen).toLocaleDateString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Last Seen
                </p>
                <p className="text-sm font-medium text-foreground font-mono">
                  {lastSeen ? new Date(lastSeen).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── OVERVIEW + DISCLOSED DATA ─── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Company Overview
              </h2>
              <div className="bg-background rounded-lg p-4 border border-border min-h-[80px]">
                {posts[0]?.description ? (
                  <p className="text-sm text-foreground leading-relaxed">{posts[0].description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No company overview available. Data may be enriched from external sources.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Disclosed Data
              </h2>
              <div className="bg-background rounded-lg p-4 border border-border min-h-[80px]">
                {posts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-foreground">
                      <span className="font-mono text-primary font-medium">{posts.length}</span>{" "}
                      disclosure{posts.length !== 1 ? "s" : ""} found across{" "}
                      <span className="font-mono text-primary font-medium">{claimingGroups.length}</span>{" "}
                      threat group{claimingGroups.length !== 1 ? "s" : ""}.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Activity spans from {firstSeen ? new Date(firstSeen).toLocaleDateString() : "—"} to{" "}
                      {lastSeen ? new Date(lastSeen).toLocaleDateString() : "—"}.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No disclosed information available yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── ACTIVITY TIMELINE CHART ─── */}
        {timelineData.length > 1 && (
          <Card className="border-border bg-card">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Activity Timeline
              </h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="posts" name="Posts" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── POSTS TABLE ─── */}
        <Card className="border-border bg-card overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Posts</h2>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {posts.length}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Title</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Description</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Group</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">
                    Screen
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Shield className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-sm font-medium">No posts found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPosts.map((post, idx) => (
                    <TableRow key={`${post.group_name}-${post.post_title}-${idx}`} className="group">
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {post.discovered ? new Date(post.discovered).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="font-medium text-foreground max-w-[250px] truncate">
                        {post.post_title || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {post.description || "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => navigate(`/group/${encodeURIComponent(post.group_name)}`)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-severity-critical/10 text-severity-critical text-xs font-mono hover:bg-severity-critical/20 transition-colors"
                        >
                          <Skull className="h-3 w-3" />
                          {post.group_name}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        {post.website ? (
                          <a
                            href={post.website.startsWith("http") ? post.website : `https://${post.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Screen
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-mono font-medium text-foreground">
                  {(page - 1) * POSTS_PER_PAGE + 1}–{Math.min(page * POSTS_PER_PAGE, posts.length)}
                </span>{" "}
                of <span className="font-mono font-medium text-foreground">{posts.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2 font-mono">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
