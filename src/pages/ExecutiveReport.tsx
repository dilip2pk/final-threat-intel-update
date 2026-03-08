import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Loader2, Shield, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, Bug, Radar, Eye, Ticket } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#14b8a6",
  unknown: "#6b7280",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#14b8a6",
  info: "#6b7280",
};

function TrendIcon({ trend }: { trend: string }) {
  const t = trend.toLowerCase();
  if (t.includes("increas") || t.includes("wors") || t.includes("escalat")) return <TrendingUp className="h-5 w-5 text-destructive" />;
  if (t.includes("decreas") || t.includes("improv")) return <TrendingDown className="h-5 w-5 text-green-500" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

function riskBadgeVariant(risk: string): "destructive" | "default" | "secondary" | "outline" {
  if (risk === "critical" || risk === "high") return "destructive";
  if (risk === "medium") return "default";
  return "secondary";
}

export default function ExecutiveReport() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("executive-report", {
        body: { period },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to generate report");
      setReport(data.report);
      toast.success("Executive report generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!report) return;
    const ai = report.ai || {};
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    let y = 0;

    const checkPage = (needed: number) => { if (y + needed > ph - 20) { doc.addPage(); y = 20; } };

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 38, "F");
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`${report.appName} — ${report.periodLabel} Executive Briefing`, m, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const from = new Date(report.dateRange.from).toLocaleDateString();
    const to = new Date(report.dateRange.to).toLocaleDateString();
    doc.text(`Period: ${from} — ${to}  |  Generated: ${new Date().toLocaleString()}`, m, 30);

    // Risk level bar
    y = 44;
    const riskColor = RISK_COLORS[ai.overall_risk_level] || "#6b7280";
    const [rr, rg, rb] = hexToRgb(riskColor);
    doc.setFillColor(rr, rg, rb);
    doc.roundedRect(m, y, 50, 10, 2, 2, "F");
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`RISK: ${(ai.overall_risk_level || "N/A").toUpperCase()}`, m + 25, y + 7, { align: "center" });
    y += 18;

    // Executive Summary
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary", m, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50);
    const summaryLines = doc.splitTextToSize(ai.executive_summary || "N/A", pw - 2 * m);
    doc.text(summaryLines, m, y);
    y += summaryLines.length * 4 + 8;

    // Stats boxes
    checkPage(25);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Key Metrics", m, y);
    y += 6;
    const stats = report.stats;
    const metrics = [
      ["Scans", String(stats.totalScans)],
      ["CVEs Tracked", String(stats.totalCves)],
      ["Open Tickets", String(stats.tickets.open)],
      ["Alert Rules", String(stats.activeAlertRules)],
      ["Watchlist Orgs", String(stats.watchlistOrgs)],
      ["Ransom Matches", String(stats.ransomMatches)],
    ];
    const colW = (pw - 2 * m) / 3;
    metrics.forEach(([label, val], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = m + col * colW;
      const yy = y + row * 18;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x + 1, yy, colW - 2, 15, 2, 2, "F");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(val, x + colW / 2, yy + 8, { align: "center" });
      doc.setTextColor(100);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + colW / 2, yy + 13, { align: "center" });
    });
    y += Math.ceil(metrics.length / 3) * 18 + 8;

    // Key Findings
    if (ai.key_findings?.length) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Key Findings", m, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50);
      for (const f of ai.key_findings) {
        checkPage(8);
        const fLines = doc.splitTextToSize(`• ${f}`, pw - 2 * m - 5);
        doc.text(fLines, m + 3, y);
        y += fLines.length * 4 + 2;
      }
      y += 5;
    }

    // Recommendations
    if (ai.recommendations?.length) {
      checkPage(20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Recommendations", m, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      for (const r of ai.recommendations) {
        checkPage(8);
        doc.setFillColor(240, 253, 244);
        const rLines = doc.splitTextToSize(r, pw - 2 * m - 10);
        const h = rLines.length * 4 + 6;
        doc.roundedRect(m, y, pw - 2 * m, h, 2, 2, "F");
        doc.setTextColor(50);
        doc.text(rLines, m + 5, y + 5);
        y += h + 3;
      }
      y += 5;
    }

    // Top CVEs table
    if (report.cves?.length) {
      checkPage(30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Top CVEs", m, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["CVE ID", "Title", "Severity"]],
        body: report.cves.map((c: any) => [c.id, c.title, c.severity.toUpperCase()]),
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: m, right: m },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Trend
    if (ai.trend_assessment) {
      checkPage(15);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Trend Assessment", m, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50);
      const tLines = doc.splitTextToSize(ai.trend_assessment, pw - 2 * m);
      doc.text(tLines, m, y);
    }

    // Footer
    const total = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`${report.appName} — Confidential`, m, ph - 8);
      doc.text(`Page ${i} of ${total}`, pw / 2, ph - 8, { align: "center" });
      doc.text(new Date().toLocaleDateString(), pw - m, ph - 8, { align: "right" });
    }

    doc.save(`executive-report-${report.period}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF downloaded!");
  };

  const ai = report?.ai || {};
  const stats = report?.stats || {};

  const riskPieData = stats.scansByRisk ? Object.entries(stats.scansByRisk).map(([name, value]) => ({ name, value })) : [];
  const cvePieData = stats.cveBySeverity ? Object.entries(stats.cveBySeverity).map(([name, value]) => ({ name, value })) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Executive Risk Report
            </h1>
            <p className="text-muted-foreground text-sm mt-1">AI-generated security briefing with trends and recommendations</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v: "weekly" | "monthly") => setPeriod(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generateReport} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
              Generate Report
            </Button>
            {report && (
              <Button variant="outline" onClick={downloadPDF}>
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
            )}
          </div>
        </div>

        {!report && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Report Generated</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Select a period and click "Generate Report" to create an AI-powered executive security briefing with data from all your threat sources.
              </p>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Gathering data and generating AI analysis…</p>
            </CardContent>
          </Card>
        )}

        {report && !loading && (
          <>
            {/* Risk Level + Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Overall Risk Level</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  <div className="rounded-full w-24 h-24 flex items-center justify-center" style={{ backgroundColor: RISK_COLORS[ai.overall_risk_level] || "#6b7280" }}>
                    <Shield className="h-10 w-10 text-white" />
                  </div>
                  <Badge variant={riskBadgeVariant(ai.overall_risk_level)} className="text-lg px-4 py-1 uppercase">
                    {ai.overall_risk_level || "N/A"}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <TrendIcon trend={ai.trend_assessment || ""} />
                    <span className="text-xs">{ai.trend_assessment || "N/A"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Executive Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed">{ai.executive_summary || "No AI summary available."}</p>
                  <Separator className="my-4" />
                  <div className="text-xs text-muted-foreground">
                    {report.periodLabel} report • {new Date(report.dateRange.from).toLocaleDateString()} — {new Date(report.dateRange.to).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Scans", value: stats.totalScans, icon: Radar, color: "text-blue-500" },
                { label: "CVEs Tracked", value: stats.totalCves, icon: Bug, color: "text-orange-500" },
                { label: "Open Tickets", value: stats.tickets?.open, icon: Ticket, color: "text-yellow-500" },
                { label: "Alert Rules", value: stats.activeAlertRules, icon: AlertTriangle, color: "text-red-500" },
                { label: "Watchlist Orgs", value: stats.watchlistOrgs, icon: Eye, color: "text-purple-500" },
                { label: "Ransom Matches", value: stats.ransomMatches, icon: Shield, color: "text-pink-500" },
              ].map((m) => (
                <Card key={m.label}>
                  <CardContent className="pt-4 pb-3 text-center">
                    <m.icon className={`h-5 w-5 mx-auto mb-1 ${m.color}`} />
                    <div className="text-2xl font-bold text-foreground">{m.value ?? 0}</div>
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              {riskPieData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Scans by Risk Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                          {riskPieData.map((entry: any) => (
                            <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#6b7280"} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {cvePieData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">CVEs by Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={cvePieData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {cvePieData.map((entry: any) => (
                            <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || "#6b7280"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Key Findings + Recommendations */}
            <div className="grid gap-4 md:grid-cols-2">
              {ai.key_findings?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" /> Key Findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ai.key_findings.map((f: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground">
                          <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {ai.recommendations?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" /> Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ai.recommendations.map((r: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground">
                          <Badge variant="outline" className="shrink-0 h-5 w-5 flex items-center justify-center text-xs p-0">{i + 1}</Badge>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Top CVEs Table */}
            {report.cves?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top CVEs This Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">CVE ID</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Title</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.cves.map((c: any, i: number) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2 font-mono text-xs">{c.id}</td>
                            <td className="py-2">{c.title}</td>
                            <td className="py-2">
                              <Badge variant={c.severity === "critical" || c.severity === "high" ? "destructive" : "secondary"} className="uppercase text-xs">
                                {c.severity}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Tickets */}
            {report.tickets?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">#</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Title</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Priority</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.tickets.map((t: any, i: number) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2 font-mono text-xs">{t.number}</td>
                            <td className="py-2">{t.title}</td>
                            <td className="py-2">
                              <Badge variant={t.priority === "Critical" || t.priority === "High" ? "destructive" : "secondary"} className="text-xs">
                                {t.priority}
                              </Badge>
                            </td>
                            <td className="py-2 text-muted-foreground">{t.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
