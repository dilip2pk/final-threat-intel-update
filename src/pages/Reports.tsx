import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, Download, Trash2, Eye, Loader2, Search, CalendarDays, Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/apiClient";
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from "date-fns";

interface GeneratedReport {
  id: string;
  scan_id: string | null;
  name: string;
  format: string;
  report_html: string | null;
  scan_target: string | null;
  scan_type: string | null;
  created_at: string;
}

export default function Reports() {
  const { toast } = useToast();
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewReport, setPreviewReport] = useState<GeneratedReport | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");

  const fetchReports = async () => {
    const { data } = await supabase
      .from("generated_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setReports(data as unknown as GeneratedReport[]);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const filteredReports = reports.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !(r.scan_target || "").toLowerCase().includes(q)) return false;
    }
    if (formatFilter !== "all" && r.format !== formatFilter) return false;
    if (dateFrom) {
      if (isBefore(parseISO(r.created_at), startOfDay(parseISO(dateFrom)))) return false;
    }
    if (dateTo) {
      if (isAfter(parseISO(r.created_at), endOfDay(parseISO(dateTo)))) return false;
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    await supabase.from("generated_reports").delete().eq("id", id);
    setReports(prev => prev.filter(r => r.id !== id));
    toast({ title: "Report Deleted" });
  };

  const handleDownload = (report: GeneratedReport) => {
    if (!report.report_html) return;
    const ext = report.format === "csv" ? "csv" : "html";
    const mime = report.format === "csv" ? "text/csv" : "text/html";
    const blob = new Blob([report.report_html], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, "-")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setFormatFilter("all");
  };

  const hasFilters = searchQuery || dateFrom || dateTo || formatFilter !== "all";

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All generated scan reports in one place — preview, download, or manage
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-border rounded-lg bg-card p-4 text-center">
            <div className="text-2xl font-bold text-primary">{reports.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Reports</div>
          </div>
          <div className="border border-border rounded-lg bg-card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{reports.filter(r => r.format === "html").length}</div>
            <div className="text-xs text-muted-foreground mt-1">HTML</div>
          </div>
          <div className="border border-border rounded-lg bg-card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{reports.filter(r => r.format === "csv").length}</div>
            <div className="text-xs text-muted-foreground mt-1">CSV</div>
          </div>
          <div className="border border-border rounded-lg bg-card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{reports.filter(r => r.format === "pdf").length}</div>
            <div className="text-xs text-muted-foreground mt-1">PDF</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 border border-border rounded-lg bg-card p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or target..."
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm w-[150px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm w-[150px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Format</label>
            <select
              value={formatFilter}
              onChange={e => setFormatFilter(e.target.value)}
              className="h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground"
            >
              <option value="all">All</option>
              <option value="html">HTML</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
              Clear
            </Button>
          )}
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {hasFilters ? "No reports match your filters." : "No reports generated yet. Export a report from Network Scanner to see it here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""}</p>
            {filteredReports.map(report => (
              <div key={report.id} className="border border-border rounded-lg bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                <div className="p-2 rounded-md bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{report.name}</span>
                    <Badge variant="outline" className="text-[10px]">{report.format.toUpperCase()}</Badge>
                  </div>
                  <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    {report.scan_target && <span>Target: {report.scan_target}</span>}
                    {report.scan_type && <span>Type: {report.scan_type}</span>}
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(report.created_at), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {report.report_html && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewReport(report)} title="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(report)} title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(report.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={!!previewReport} onOpenChange={() => setPreviewReport(null)}>
          <DialogContent className="bg-card border-border max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {previewReport?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh] rounded border border-border">
              {previewReport?.report_html && (
                <iframe
                  srcDoc={previewReport.report_html}
                  className="w-full min-h-[60vh] border-0"
                  title="Report Preview"
                />
              )}
            </div>
            <DialogFooter>
              {previewReport && (
                <Button onClick={() => handleDownload(previewReport)} className="gap-2">
                  <Download className="h-4 w-4" /> Download
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
