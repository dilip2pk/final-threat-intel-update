import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Mail, Ticket, Search, Loader2, RefreshCw, Clock, User,
  CheckCircle2, AlertCircle, Circle, ArrowRight, MessageSquare,
  Download, FileText, FileSpreadsheet, Code, Filter,
  TrendingUp, BarChart3, XCircle, Plus, Trash2, Database,
} from "lucide-react";
import { useEmailLog, useTicketLog, useTicketHistory, type TicketLogEntry } from "@/hooks/useActivityLog";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Helpers ──

const statusColors: Record<string, string> = {
  Open: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  "In Progress": "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  Resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  Closed: "bg-muted text-muted-foreground border-border",
  sent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

const priorityColors: Record<string, string> = {
  Critical: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  High: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  Medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400",
  Low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "Open": return <Circle className="h-3 w-3 text-orange-500" />;
    case "In Progress": return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    case "Resolved": return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case "Closed": return <CheckCircle2 className="h-3 w-3 text-muted-foreground" />;
    case "sent": return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case "failed": return <XCircle className="h-3 w-3 text-destructive" />;
    default: return <Circle className="h-3 w-3" />;
  }
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Sample Data ──

const SAMPLE_TICKETS = [
  { ticket_number: "TKT-001", title: "Critical RCE in Apache Struts — CVE-2026-1234", description: "A critical remote code execution vulnerability was identified in Apache Struts 2.0–6.3.0. Immediate patching required.", status: "Open", priority: "Critical", assigned_to: "Alice Chen", category: "Vulnerability" },
  { ticket_number: "TKT-002", title: "Ransomware campaign targeting healthcare — MedLock", description: "Spear-phishing emails with malicious PDF attachments targeting hospital EHR systems.", status: "In Progress", priority: "High", assigned_to: "Bob Martinez", category: "Threat Intel" },
  { ticket_number: "TKT-003", title: "NPM supply-chain compromise — credential stealer", description: "Multiple NPM packages compromised: @fake-scope/utils, helper-lib. Audit CI/CD pipelines.", status: "Open", priority: "High", assigned_to: "Carol Singh", category: "Supply Chain" },
  { ticket_number: "TKT-004", title: "Linux Kernel 6.x privilege escalation — CVE-2026-2001", description: "8 new CVEs affecting Linux Kernel 6.0–6.7 including local privilege escalation.", status: "Resolved", priority: "Medium", assigned_to: "Dave Wilson", category: "Vulnerability" },
  { ticket_number: "TKT-005", title: "VPN zero-day authentication bypass — CVE-2026-0001", description: "Actively exploited zero-day in enterprise VPN gateway v8.x. Disable SSL VPN portal.", status: "In Progress", priority: "Critical", assigned_to: "Alice Chen", category: "Zero-Day" },
  { ticket_number: "TKT-006", title: "CISA KEV additions — Adobe, Citrix, Fortinet", description: "3 new entries added to CISA KEV catalog. Federal patch deadline: March 5, 2026.", status: "Open", priority: "Medium", assigned_to: "Eve Nakamura", category: "Compliance" },
  { ticket_number: "TKT-007", title: "AI-generated phishing kit detection", description: "New phishing kit using generative AI for emails and landing pages. Update email filters.", status: "Closed", priority: "Low", assigned_to: "Bob Martinez", category: "Phishing" },
  { ticket_number: "TKT-008", title: "Microsoft Patch Tuesday — Feb 2026, 12 Critical", description: "78 vulnerabilities across Windows, Office, Azure. 12 rated Critical.", status: "Resolved", priority: "High", assigned_to: "Carol Singh", category: "Patch Management" },
];

// ── Ticket Templates ──

interface TicketTemplate {
  name: string;
  ticket_number_prefix: string;
  status: string;
  priority: string;
  category: string;
  subcategory: string;
  service_category: string;
  group: string;
  description: string;
}

const TICKET_TEMPLATES: TicketTemplate[] = [
  { name: "Default Request", ticket_number_prefix: "TKT", status: "Open", priority: "Medium", category: "General", subcategory: "", service_category: "Technology Services (IT/ABS)", group: "Technology Services - Dispatch", description: "" },
  { name: "Security Incident", ticket_number_prefix: "SEC", status: "Open", priority: "Critical", category: "Security Incident", subcategory: "Malware/Ransomware", service_category: "Security Operations", group: "Cybersecurity Team", description: "Security incident requiring immediate investigation and containment." },
  { name: "Vulnerability Report", ticket_number_prefix: "VUL", status: "Open", priority: "High", category: "Vulnerability", subcategory: "CVE Assessment", service_category: "Security Operations", group: "Vulnerability Management", description: "New vulnerability identified requiring assessment and remediation planning." },
  { name: "Patch Request", ticket_number_prefix: "PAT", status: "Open", priority: "Medium", category: "Patch Management", subcategory: "OS/Application Update", service_category: "Technology Services (IT/ABS)", group: "Infrastructure Team", description: "Patch deployment request for identified vulnerabilities." },
  { name: "Threat Intelligence", ticket_number_prefix: "TI", status: "Open", priority: "High", category: "Threat Intel", subcategory: "IOC Investigation", service_category: "Security Operations", group: "Threat Intel Team", description: "Threat intelligence item requiring analysis and action." },
  { name: "Compliance Finding", ticket_number_prefix: "CMP", status: "Open", priority: "Medium", category: "Compliance", subcategory: "Audit Finding", service_category: "Governance & Compliance", group: "GRC Team", description: "Compliance finding or audit observation requiring remediation." },
];

// ── Export Functions ──

function exportCSV(tickets: any[], emails: any[], tab: string) {
  let csv = "";
  if (tab === "tickets") {
    csv = "Ticket #,Title,Status,Priority,Assigned To,Category,Created,Updated\n";
    for (const t of tickets) {
      csv += `"${t.ticket_number}","${t.title}","${t.status}","${t.priority}","${t.assigned_to || ""}","${t.category || ""}","${formatDate(t.created_at)}","${formatDate(t.updated_at)}"\n`;
    }
  } else {
    csv = "Subject,Recipients,Status,Feed,Error,Date\n";
    for (const e of emails) {
      csv += `"${e.subject}","${e.recipients.join("; ")}","${e.status}","${e.related_feed_title || ""}","${e.error_message || ""}","${formatDate(e.created_at)}"\n`;
    }
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportHTML(tickets: any[], emails: any[], tab: string) {
  const rows = tab === "tickets"
    ? tickets.map(t => `<tr><td>${t.ticket_number}</td><td>${t.title}</td><td>${t.status}</td><td>${t.priority}</td><td>${t.assigned_to || "—"}</td><td>${formatDate(t.updated_at)}</td></tr>`).join("")
    : emails.map(e => `<tr><td>${e.subject}</td><td>${e.recipients.join(", ")}</td><td>${e.status}</td><td>${e.related_feed_title || "—"}</td><td>${formatDate(e.created_at)}</td></tr>`).join("");

  const headers = tab === "tickets"
    ? "<th>Ticket #</th><th>Title</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Updated</th>"
    : "<th>Subject</th><th>Recipients</th><th>Status</th><th>Feed</th><th>Date</th>";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Activity Log - ${tab}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:40px;color:#1a1a1a}
h1{font-size:24px;margin-bottom:4px}p.sub{color:#666;font-size:13px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f1f5f9;text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;font-weight:600}
td{padding:10px 12px;border-bottom:1px solid #e2e8f0}
tr:hover{background:#f8fafc}</style></head>
<body><h1>Activity Log — ${tab === "tickets" ? "Tickets" : "Emails"}</h1>
<p class="sub">Exported on ${new Date().toLocaleString()}</p>
<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-${tab}-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(tickets: any[], emails: any[], tab: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const m = 15;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, 28, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`Activity Log — ${tab === "tickets" ? "Tickets" : "Emails"}`, m, 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Exported: ${new Date().toLocaleString()}`, m, 23);

  if (tab === "tickets") {
    autoTable(doc, {
      startY: 34,
      head: [["Ticket #", "Title", "Status", "Priority", "Assigned To", "Category", "Updated"]],
      body: tickets.map(t => [t.ticket_number, t.title, t.status, t.priority, t.assigned_to || "—", t.category || "—", formatDate(t.updated_at)]),
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: m, right: m },
    });
  } else {
    autoTable(doc, {
      startY: 34,
      head: [["Subject", "Recipients", "Status", "Feed", "Error", "Date"]],
      body: emails.map(e => [e.subject, e.recipients.join(", "), e.status, e.related_feed_title || "—", e.error_message || "—", formatDate(e.created_at)]),
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: m, right: m },
    });
  }

  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("Confidential — Activity Log Export", m, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${i} of ${total}`, pw - m, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  doc.save(`activity-${tab}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Stat Card ──

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) => (
  <Card>
    <CardContent className="flex items-center gap-3 py-4">
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

// ── Main Component ──

export default function ActivityLog() {
  const { entries: emails, loading: emailsLoading, reload: reloadEmails } = useEmailLog();
  const { tickets, loading: ticketsLoading, updateTicket, deleteTicket, logTicket, reload: reloadTickets } = useTicketLog();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("tickets");
  const [selectedTicket, setSelectedTicket] = useState<TicketLogEntry | null>(null);
  const { toast } = useToast();

  const { history, addHistoryEntry } = useTicketHistory(selectedTicket?.id ?? null);
  const [newStatus, setNewStatus] = useState("");
  const [newNote, setNewNote] = useState("");

  // Add ticket dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const emptyForm = { ticket_number: "", title: "", description: "", status: "Open", priority: "Medium", assigned_to: "", category: "", subcategory: "", service_category: "Technology Services (IT/ABS)", group: "Technology Services - Dispatch", notify_emails: "", subject: "" };
  const [addForm, setAddForm] = useState(emptyForm);
  const [addLoading, setAddLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("Default Request");

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sample data loading
  const [sampleLoading, setSampleLoading] = useState(false);

  const isWithinDate = (dateStr: string) => {
    if (dateFilter === "all") return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (dateFilter === "today") return d.toDateString() === now.toDateString();
    if (dateFilter === "7d") return d >= new Date(now.getTime() - 7 * 86400000);
    if (dateFilter === "30d") return d >= new Date(now.getTime() - 30 * 86400000);
    if (dateFilter === "90d") return d >= new Date(now.getTime() - 90 * 86400000);
    return true;
  };

  const filteredEmails = useMemo(() => emails.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.subject.toLowerCase().includes(q) && !e.recipients.join(",").toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (!isWithinDate(e.created_at)) return false;
    return true;
  }), [emails, search, statusFilter, dateFilter]);

  const filteredTickets = useMemo(() => tickets.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.ticket_number.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (!isWithinDate(t.created_at)) return false;
    return true;
  }), [tickets, search, statusFilter, priorityFilter, dateFilter]);

  const ticketStats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === "Open").length,
    inProgress: tickets.filter(t => t.status === "In Progress").length,
    resolved: tickets.filter(t => t.status === "Resolved" || t.status === "Closed").length,
  }), [tickets]);

  const emailStats = useMemo(() => ({
    total: emails.length,
    sent: emails.filter(e => e.status === "sent").length,
    failed: emails.filter(e => e.status === "failed").length,
  }), [emails]);

  const handleStatusChange = async () => {
    if (!selectedTicket || !newStatus) return;
    const oldStatus = selectedTicket.status;
    await updateTicket(selectedTicket.id, { status: newStatus });
    await addHistoryEntry({ ticket_id: selectedTicket.id, action: "status_change", old_value: oldStatus, new_value: newStatus, actor: "System" });
    setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
    setNewStatus("");
    toast({ title: "Status Updated", description: `Ticket updated to ${newStatus}` });
  };

  const handleAddNote = async () => {
    if (!selectedTicket || !newNote.trim()) return;
    await addHistoryEntry({ ticket_id: selectedTicket.id, action: "comment", new_value: newNote, actor: "Analyst" });
    if (newNote.toLowerCase().includes("resolution") || newNote.toLowerCase().includes("resolved")) {
      await updateTicket(selectedTicket.id, { resolution_notes: newNote });
    }
    setNewNote("");
    toast({ title: "Note Added" });
  };

  const handleExport = (format: "pdf" | "csv" | "html") => {
    const data = activeTab === "tickets" ? filteredTickets : filteredEmails;
    if (data.length === 0) {
      toast({ title: "Nothing to export", description: "No records match your current filters.", variant: "destructive" });
      return;
    }
    if (format === "csv") exportCSV(filteredTickets, filteredEmails, activeTab);
    else if (format === "html") exportHTML(filteredTickets, filteredEmails, activeTab);
    else exportPDF(filteredTickets, filteredEmails, activeTab);
    toast({ title: "Export Complete", description: `${activeTab} exported as ${format.toUpperCase()}` });
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setDateFilter("all");
  };

  const handleAddTicket = async () => {
    if (!addForm.ticket_number || !addForm.title) return;
    setAddLoading(true);
    const { error } = await logTicket(addForm);
    setAddLoading(false);
    if (!error) {
      setShowAddDialog(false);
      setAddForm({ ticket_number: "", title: "", description: "", status: "Open", priority: "Medium", assigned_to: "", category: "" });
      toast({ title: "Ticket Created", description: `${addForm.ticket_number} added successfully.` });
    } else {
      toast({ title: "Error", description: "Failed to create ticket.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    const { error } = await deleteTicket(deleteId);
    setDeleteLoading(false);
    setDeleteId(null);
    if (!error) {
      if (selectedTicket?.id === deleteId) setSelectedTicket(null);
      toast({ title: "Ticket Deleted" });
    } else {
      toast({ title: "Error", description: "Failed to delete ticket.", variant: "destructive" });
    }
  };

  const handleLoadSampleData = async () => {
    setSampleLoading(true);
    let count = 0;
    for (const sample of SAMPLE_TICKETS) {
      const { error } = await logTicket(sample);
      if (!error) count++;
    }
    setSampleLoading(false);
    toast({ title: "Sample Data Loaded", description: `${count} sample tickets created.` });
  };

  const hasActiveFilters = search || statusFilter !== "all" || priorityFilter !== "all" || dateFilter !== "all";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Activity Log
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Track tickets, emails, and operational activity</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
                  <FileText className="h-4 w-4 text-red-500" /> Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("html")} className="gap-2">
                  <Code className="h-4 w-4 text-blue-500" /> Export as HTML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { reloadEmails(); reloadTickets(); }}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <StatCard label="Total Tickets" value={ticketStats.total} icon={Ticket} color="bg-primary/10 text-primary" />
          <StatCard label="Open" value={ticketStats.open} icon={Circle} color="bg-orange-500/10 text-orange-500" />
          <StatCard label="In Progress" value={ticketStats.inProgress} icon={TrendingUp} color="bg-blue-500/10 text-blue-500" />
          <StatCard label="Emails Sent" value={emailStats.sent} icon={Mail} color="bg-emerald-500/10 text-emerald-500" />
          <StatCard label="Failed" value={emailStats.failed} icon={AlertCircle} color="bg-destructive/10 text-destructive" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                <Filter className="h-4 w-4" /> Filters
              </div>
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search subject, ticket number, recipient..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Date Range" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground shrink-0">
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="tickets" className="gap-2 data-[state=active]:bg-background">
                <Ticket className="h-3.5 w-3.5" /> Tickets
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{filteredTickets.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-2 data-[state=active]:bg-background">
                <Mail className="h-3.5 w-3.5" /> Emails
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{filteredEmails.length}</Badge>
              </TabsTrigger>
            </TabsList>
            {activeTab === "tickets" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleLoadSampleData} disabled={sampleLoading}>
                  {sampleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Load Sample Data
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4" /> Add Ticket
                </Button>
              </div>
            )}
          </div>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-0">
            {ticketsLoading ? (
              <Card><CardContent className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground text-sm">Loading tickets...</span>
              </CardContent></Card>
            ) : filteredTickets.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center">
                <Ticket className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="font-medium text-foreground">No tickets found</p>
                <p className="text-sm text-muted-foreground mt-1">Click "Add Ticket" or "Load Sample Data" to get started.</p>
              </CardContent></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Updated</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.map(ticket => (
                        <tr
                          key={ticket.id}
                          onClick={() => setSelectedTicket(ticket)}
                          className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs text-primary font-medium">{ticket.ticket_number}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="max-w-[300px]">
                              <p className="font-medium text-foreground truncate">{ticket.title}</p>
                              {ticket.related_feed_title && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.related_feed_title}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`text-[11px] gap-1 ${statusColors[ticket.status] || ""}`}>
                              <StatusIcon status={ticket.status} /> {ticket.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`text-[11px] ${priorityColors[ticket.priority] || ""}`}>
                              {ticket.priority}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> {ticket.assigned_to || "—"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-muted-foreground font-mono">{formatShortDate(ticket.updated_at)}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteId(ticket.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails" className="space-y-0">
            {emailsLoading ? (
              <Card><CardContent className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground text-sm">Loading email log...</span>
              </CardContent></Card>
            ) : filteredEmails.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center">
                <Mail className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="font-medium text-foreground">No emails found</p>
                <p className="text-sm text-muted-foreground mt-1">Emails are sent from the feed analysis view.</p>
              </CardContent></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipients</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feed</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmails.map(email => (
                        <tr key={email.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`text-[11px] gap-1 ${statusColors[email.status] || ""}`}>
                              <StatusIcon status={email.status} /> {email.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-foreground truncate max-w-[250px]">{email.subject}</p>
                            {email.error_message && (
                              <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                                <AlertCircle className="h-3 w-3" /> {email.error_message}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-muted-foreground">{email.recipients.join(", ")}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-muted-foreground truncate max-w-[150px] block">{email.related_feed_title || "—"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-muted-foreground font-mono">{formatShortDate(email.created_at)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5 text-primary" />
                <span className="font-mono text-primary">{selectedTicket?.ticket_number}</span>
                <Separator orientation="vertical" className="h-5" />
                <span className="truncate">{selectedTicket?.title}</span>
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-5 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant="outline" className={`gap-1 ${statusColors[selectedTicket?.status || ""]}`}>
                        <StatusIcon status={selectedTicket?.status || ""} /> {selectedTicket?.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <div>
                      <Badge variant="outline" className={priorityColors[selectedTicket?.priority || ""]}>
                        {selectedTicket?.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedTicket?.assigned_to || "Unassigned"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Last Updated</Label>
                    <p className="text-sm font-mono flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedTicket?.updated_at ? formatDate(selectedTicket.updated_at) : "—"}
                    </p>
                  </div>
                  {selectedTicket?.description && (
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>
                  )}
                  {selectedTicket?.resolution_notes && (
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Resolution Notes</Label>
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3">
                        <p className="text-sm">{selectedTicket.resolution_notes}</p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Update Status</Label>
                  <div className="flex gap-2">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select new status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleStatusChange} disabled={!newStatus}>Update</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add Note</Label>
                  <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add investigation notes, resolution details..." rows={2} />
                  <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()} className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Add Note
                  </Button>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</Label>
                  {history.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No timeline entries yet</p>
                  ) : (
                    <div className="space-y-0">
                      {history.map((entry, idx) => (
                        <div key={entry.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${entry.action === "status_change" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            {idx < history.length - 1 && <div className="w-px flex-1 bg-border" />}
                          </div>
                          <div className="pb-4 flex-1">
                            {entry.action === "status_change" ? (
                              <p className="text-xs">
                                <span className="font-medium text-foreground">{entry.actor || "System"}</span>{" "}
                                changed status{" "}
                                <Badge variant="outline" className="text-[10px] mx-0.5">{entry.old_value}</Badge>
                                <ArrowRight className="inline h-3 w-3 mx-0.5" />
                                <Badge variant="outline" className="text-[10px] mx-0.5">{entry.new_value}</Badge>
                              </p>
                            ) : (
                              <div>
                                <p className="text-xs font-medium text-foreground">{entry.actor || "System"}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{entry.new_value}</p>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground font-mono mt-1">{formatDate(entry.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Add Ticket Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Create New Ticket
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ticket Number *</Label>
                  <Input placeholder="TKT-009" value={addForm.ticket_number} onChange={e => setAddForm(f => ({ ...f, ticket_number: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Input placeholder="e.g. Vulnerability" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Title *</Label>
                <Input placeholder="Brief ticket title..." value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea placeholder="Describe the issue..." rows={3} value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={addForm.status} onValueChange={v => setAddForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <Select value={addForm.priority} onValueChange={v => setAddForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Assigned To</Label>
                  <Input placeholder="Name" value={addForm.assigned_to} onChange={e => setAddForm(f => ({ ...f, assigned_to: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddTicket} disabled={addLoading || !addForm.ticket_number || !addForm.title} className="gap-2">
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" /> Delete Ticket
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this ticket? This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading} className="gap-2">
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}