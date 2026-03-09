import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/apiClient";

export interface EmailLogEntry {
  id: string;
  recipients: string[];
  subject: string;
  body: string | null;
  related_feed_id: string | null;
  related_feed_title: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface TicketLogEntry {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  category: string | null;
  resolution_notes: string | null;
  related_feed_id: string | null;
  related_feed_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketHistoryEntry {
  id: string;
  ticket_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  actor: string | null;
  created_at: string;
}

export function useEmailLog() {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("email_log")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setEntries(data);
    } catch (e) {
      console.error("Failed to load email log:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logEmail = useCallback(async (entry: {
    recipients: string[];
    subject: string;
    body?: string;
    related_feed_id?: string;
    related_feed_title?: string;
    status: string;
    error_message?: string;
  }) => {
    const { data, error } = await supabase
      .from("email_log")
      .insert(entry)
      .select()
      .single();
    if (data) setEntries(prev => [data, ...prev]);
    return { data, error };
  }, []);

  return { entries, loading, logEmail, reload: load };
}

export function useTicketLog() {
  const [tickets, setTickets] = useState<TicketLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("ticket_log")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTickets(data);
    } catch (e) {
      console.error("Failed to load ticket log:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("ticket_log_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_log" }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const logTicket = useCallback(async (entry: {
    ticket_number: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigned_to?: string;
    category?: string;
    related_feed_id?: string;
    related_feed_title?: string;
  }) => {
    const { data, error } = await supabase
      .from("ticket_log")
      .insert(entry)
      .select()
      .single();
    if (data) setTickets(prev => [data, ...prev]);
    return { data, error };
  }, []);

  const updateTicket = useCallback(async (id: string, updates: Partial<TicketLogEntry>) => {
    const { error } = await supabase
      .from("ticket_log")
      .update(updates)
      .eq("id", id);
    if (!error) setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    return { error };
  }, []);

  const deleteTicket = useCallback(async (id: string) => {
    // Delete history first due to FK constraint
    await supabase.from("ticket_history").delete().eq("ticket_id", id);
    const { error } = await supabase.from("ticket_log").delete().eq("id", id);
    if (!error) setTickets(prev => prev.filter(t => t.id !== id));
    return { error };
  }, []);

  return { tickets, loading, logTicket, updateTicket, deleteTicket, reload: load };
}

export function useTicketHistory(ticketId: string | null) {
  const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("ticket_history")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (data) setHistory(data);
    } catch (e) {
      console.error("Failed to load ticket history:", e);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const addHistoryEntry = useCallback(async (entry: {
    ticket_id: string;
    action: string;
    old_value?: string;
    new_value?: string;
    actor?: string;
  }) => {
    const { data, error } = await supabase
      .from("ticket_history")
      .insert(entry)
      .select()
      .single();
    if (data) setHistory(prev => [...prev, data]);
    return { data, error };
  }, []);

  return { history, loading, addHistoryEntry, reload: load };
}
