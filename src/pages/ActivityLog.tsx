import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail, Ticket, Search, Loader2, RefreshCw, Clock, User,
  CheckCircle2, AlertCircle, Circle, ArrowRight, MessageSquare,
} from "lucide-react";
import { useEmailLog, useTicketLog, useTicketHistory, type TicketLogEntry } from "@/hooks/useActivityLog";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  Open: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  "In Progress": "bg-severity-info/15 text-severity-info border-severity-info/30",
  Resolved: "bg-severity-low/15 text-severity-low border-severity-low/30",
  Closed: "bg-muted text-muted-foreground border-border",
  sent: "bg-severity-low/15 text-severity-low border-severity-low/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusIcon = (status: string) => {
  switch (status) {
    case "Open": return <Circle className="h-3 w-3" />;
    case "In Progress": return <Loader2 className="h-3 w-3" />;
    case "Resolved": return <CheckCircle2 className="h-3 w-3" />;
    case "Closed": return <CheckCircle2 className="h-3 w-3" />;
    default: return <Circle className="h-3 w-3" />;
  }
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ActivityLog() {
  const { entries: emails, loading: emailsLoading, reload: reloadEmails } = useEmailLog();
  const { tickets, loading: ticketsLoading, updateTicket, reload: reloadTickets } = useTicketLog();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketLogEntry | null>(null);
  const { toast } = useToast();

  // Ticket timeline
  const { history, addHistoryEntry } = useTicketHistory(selectedTicket?.id ?? null);
  const [newStatus, setNewStatus] = useState("");
  const [newNote, setNewNote] = useState("");

  const filteredEmails = emails.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.subject.toLowerCase().includes(q) && !e.recipients.join(",").toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const filteredTickets = tickets.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.ticket_number.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleStatusChange = async () => {
    if (!selectedTicket || !newStatus) return;
    const oldStatus = selectedTicket.status;
    await updateTicket(selectedTicket.id, { status: newStatus });
    await addHistoryEntry({
      ticket_id: selectedTicket.id,
      action: "status_change",
      old_value: oldStatus,
      new_value: newStatus,
      actor: "System",
    });
    setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
    setNewStatus("");
    toast({ title: "Status Updated", description: `Ticket updated to ${newStatus}` });
  };

  const handleAddNote = async () => {
    if (!selectedTicket || !newNote.trim()) return;
    await addHistoryEntry({
      ticket_id: selectedTicket.id,
      action: "comment",
      new_value: newNote,
      actor: "Analyst",
    });
    if (newNote.toLowerCase().includes("resolution") || newNote.toLowerCase().includes("resolved")) {
      await updateTicket(selectedTicket.id, { resolution_notes: newNote });
    }
    setNewNote("");
    toast({ title: "Note Added" });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground mt-1">Track sent emails and ServiceDesk tickets</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { reloadEmails(); reloadTickets(); }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by subject, ticket number..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40 bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
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
            <SelectTrigger className="w-full md:w-40 bg-card"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="tickets" className="space-y-4">
          <TabsList className="bg-muted/30 border border-border">
            <TabsTrigger value="tickets" className="gap-2"><Ticket className="h-3.5 w-3.5" /> Tickets ({tickets.length})</TabsTrigger>
            <TabsTrigger value="emails" className="gap-2"><Mail className="h-3.5 w-3.5" /> Emails ({emails.length})</TabsTrigger>
          </TabsList>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-2">
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground text-sm">Loading tickets...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tickets found. Tickets are created from the feed analysis view.</p>
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="border border-border rounded-lg bg-card p-4 hover:border-primary/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-primary">{ticket.ticket_number}</span>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[ticket.status] || ""}`}>
                          {statusIcon(ticket.status)} {ticket.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{ticket.priority}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                      {ticket.related_feed_title && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">Feed: {ticket.related_feed_title}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {ticket.assigned_to && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {ticket.assigned_to}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" /> {formatDate(ticket.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails" className="space-y-2">
            {emailsLoading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground text-sm">Loading email log...</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No emails sent yet. Send analysis reports from the feed detail view.</p>
              </div>
            ) : (
              filteredEmails.map(email => (
                <div key={email.id} className="border border-border rounded-lg bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        <Badge variant="outline" className={`text-[10px] ${statusColors[email.status] || ""}`}>
                          {email.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{email.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">To: {email.recipients.join(", ")}</p>
                      {email.related_feed_title && (
                        <p className="text-xs text-muted-foreground">Feed: {email.related_feed_title}</p>
                      )}
                      {email.error_message && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {email.error_message}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono shrink-0">{formatDate(email.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Ticket Detail / Timeline Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                {selectedTicket?.ticket_number} — {selectedTicket?.title}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-2">
                {/* Ticket Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <Badge variant="outline" className={statusColors[selectedTicket?.status || ""]}>
                        {selectedTicket?.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Priority</span>
                    <p className="font-medium">{selectedTicket?.priority}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Assigned To</span>
                    <p className="font-medium">{selectedTicket?.assigned_to || "Unassigned"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Last Updated</span>
                    <p className="font-mono text-xs">{selectedTicket?.updated_at ? formatDate(selectedTicket.updated_at) : "—"}</p>
                  </div>
                  {selectedTicket?.resolution_notes && (
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Resolution Notes</span>
                      <p className="text-sm mt-1">{selectedTicket.resolution_notes}</p>
                    </div>
                  )}
                </div>

                {/* Update Status */}
                <div className="border border-border rounded-md p-3 space-y-2">
                  <Label className="text-xs">Update Status</Label>
                  <div className="flex gap-2">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select status" /></SelectTrigger>
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

                {/* Add Note */}
                <div className="border border-border rounded-md p-3 space-y-2">
                  <Label className="text-xs">Add Comment / Note</Label>
                  <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a comment or resolution note..." rows={2} />
                  <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()} className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Add Note
                  </Button>
                </div>

                {/* Timeline */}
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</h3>
                  {history.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No timeline entries yet</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map(entry => (
                        <div key={entry.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                            <div className="w-px flex-1 bg-border" />
                          </div>
                          <div className="pb-3 flex-1">
                            {entry.action === "status_change" ? (
                              <p className="text-xs">
                                <span className="font-medium text-foreground">{entry.actor || "System"}</span> changed status{" "}
                                <Badge variant="outline" className="text-[10px]">{entry.old_value}</Badge>
                                <ArrowRight className="inline h-3 w-3 mx-1" />
                                <Badge variant="outline" className="text-[10px]">{entry.new_value}</Badge>
                              </p>
                            ) : (
                              <div>
                                <p className="text-xs font-medium text-foreground">{entry.actor || "System"}</p>
                                <p className="text-xs text-muted-foreground">{entry.new_value}</p>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatDate(entry.created_at)}</p>
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
      </div>
    </AppLayout>
  );
}
