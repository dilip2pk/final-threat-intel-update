import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, serviceNowConfig } = body;

    // Load config from DB if not passed directly
    let config = serviceNowConfig;
    if (!config) {
      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "integrations")
        .single();
      config = (settingsData?.value as any)?.serviceNow;
    }

    if (!config?.instanceUrl) {
      return jsonRes({ success: false, error: "ServiceNow not configured. Set up in Settings → Integrations." }, 400);
    }

    const authHeader = buildAuth(config);
    if (!authHeader) {
      return jsonRes({ success: false, error: "Incomplete ServiceNow credentials" }, 400);
    }

    const table = config.tableName || "incident";
    const baseUrl = `${config.instanceUrl.replace(/\/$/, "")}/api/now/table/${table}`;

    if (action === "fetch") {
      return await fetchTickets(supabase, baseUrl, authHeader, config, body);
    } else if (action === "sync") {
      return await syncTickets(supabase, baseUrl, authHeader, config);
    } else if (action === "fetch_single") {
      return await fetchSingleTicket(baseUrl, authHeader, body.ticketNumber);
    } else if (action === "update_remote") {
      return await updateRemoteTicket(supabase, baseUrl, authHeader, body);
    } else {
      return jsonRes({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("servicenow-sync error:", e);
    return jsonRes({ success: false, error: e instanceof Error ? e.message : "Sync failed" }, 500);
  }
});

// ── Fetch all tickets from ServiceNow ──
async function fetchTickets(
  supabase: any, baseUrl: string, authHeader: string, config: any, body: any
) {
  const limit = body.limit || 100;
  const offset = body.offset || 0;
  const query = body.query || "";

  let url = `${baseUrl}?sysparm_limit=${limit}&sysparm_offset=${offset}&sysparm_display_value=true&sysparm_order_by=sys_created_on DESC`;
  if (query) url += `&sysparm_query=${encodeURIComponent(query)}`;

  console.log(`Fetching ServiceNow tickets: ${url}`);

  const response = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  if (!response.ok) {
    const text = await response.text();
    return jsonRes({ success: false, error: `ServiceNow ${response.status}: ${text.slice(0, 300)}` }, response.status);
  }

  const data = await response.json();
  const results = data.result || [];
  const fm = config.fieldMapping || { title: "short_description", description: "description", priority: "priority", category: "category" };

  // Map to local format and upsert into ticket_log
  const mapped = results.map((r: any) => ({
    ticket_number: r.number || r.sys_id,
    title: r[fm.title] || r.short_description || "Untitled",
    description: r[fm.description] || r.description || "",
    status: mapSnStatus(r.state || r.status),
    priority: mapSnPriority(r[fm.priority] || r.priority),
    assigned_to: r.assigned_to?.display_value || r.assigned_to || null,
    category: r[fm.category] || r.category || null,
    related_feed_title: r.subcategory || null,
  }));

  // Upsert each into ticket_log (skip if ticket_number exists)
  let imported = 0;
  for (const ticket of mapped) {
    const { data: existing } = await supabase
      .from("ticket_log")
      .select("id")
      .eq("ticket_number", ticket.ticket_number)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("ticket_log").insert(ticket);
      if (!error) imported++;
    } else {
      // Update status if changed
      await supabase.from("ticket_log")
        .update({ status: ticket.status, priority: ticket.priority, assigned_to: ticket.assigned_to })
        .eq("id", existing.id);
    }
  }

  return jsonRes({
    success: true,
    total: results.length,
    imported,
    updated: results.length - imported,
    tickets: mapped,
  });
}

// ── Sync local tickets with ServiceNow statuses ──
async function syncTickets(supabase: any, baseUrl: string, authHeader: string, config: any) {
  const { data: localTickets } = await supabase
    .from("ticket_log")
    .select("id, ticket_number, status, priority, assigned_to")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!localTickets?.length) {
    return jsonRes({ success: true, synced: 0, message: "No local tickets to sync" });
  }

  let synced = 0;
  const changes: any[] = [];

  for (const local of localTickets) {
    if (!local.ticket_number?.startsWith("INC") && !local.ticket_number?.startsWith("REQ") && !local.ticket_number?.startsWith("RQ")) {
      continue; // Skip non-ServiceNow tickets
    }

    try {
      const url = `${baseUrl}?sysparm_query=number=${local.ticket_number}&sysparm_display_value=true&sysparm_limit=1`;
      const res = await fetch(url, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn(`Failed to fetch ${local.ticket_number}: ${res.status} ${text.slice(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const remote = data.result?.[0];
      if (!remote) continue;

      const fm = config.fieldMapping || { priority: "priority" };
      const remoteStatus = mapSnStatus(remote.state || remote.status);
      const remotePriority = mapSnPriority(remote[fm.priority] || remote.priority);
      const remoteAssigned = remote.assigned_to?.display_value || remote.assigned_to || null;

      const updates: Record<string, string> = {};
      if (remoteStatus !== local.status) updates.status = remoteStatus;
      if (remotePriority !== local.priority) updates.priority = remotePriority;
      if (remoteAssigned && remoteAssigned !== local.assigned_to) updates.assigned_to = remoteAssigned;

      if (Object.keys(updates).length > 0) {
        await supabase.from("ticket_log").update(updates).eq("id", local.id);

        // Log status change in history
        if (updates.status) {
          await supabase.from("ticket_history").insert({
            ticket_id: local.id,
            action: "status_change",
            old_value: local.status,
            new_value: updates.status,
            actor: "ServiceNow Sync",
          });
        }

        changes.push({ ticket_number: local.ticket_number, ...updates });
        synced++;
      }
    } catch (e) {
      console.warn(`Error syncing ${local.ticket_number}:`, e);
    }
  }

  return jsonRes({ success: true, synced, total: localTickets.length, changes });
}

// ── Fetch a single ticket by number ──
async function fetchSingleTicket(baseUrl: string, authHeader: string, ticketNumber: string) {
  if (!ticketNumber) return jsonRes({ success: false, error: "Missing ticketNumber" }, 400);

  const url = `${baseUrl}?sysparm_query=number=${ticketNumber}&sysparm_display_value=true&sysparm_limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    return jsonRes({ success: false, error: `ServiceNow ${res.status}: ${text.slice(0, 200)}` }, res.status);
  }

  const data = await res.json();
  return jsonRes({ success: true, ticket: data.result?.[0] || null });
}

// ── Update a remote ticket (push status/notes back) ──
async function updateRemoteTicket(supabase: any, baseUrl: string, authHeader: string, body: any) {
  const { ticketNumber, updates } = body;
  if (!ticketNumber || !updates) return jsonRes({ success: false, error: "Missing ticketNumber or updates" }, 400);

  // First find sys_id
  const lookupUrl = `${baseUrl}?sysparm_query=number=${ticketNumber}&sysparm_fields=sys_id&sysparm_limit=1`;
  const lookupRes = await fetch(lookupUrl, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  if (!lookupRes.ok) {
    const text = await lookupRes.text();
    return jsonRes({ success: false, error: `Lookup failed: ${lookupRes.status}` }, lookupRes.status);
  }

  const lookupData = await lookupRes.json();
  const sysId = lookupData.result?.[0]?.sys_id;
  if (!sysId) return jsonRes({ success: false, error: `Ticket ${ticketNumber} not found in ServiceNow` }, 404);

  // Build update payload
  const payload: Record<string, string> = {};
  if (updates.status) payload.state = reverseMapStatus(updates.status);
  if (updates.resolution_notes) payload.close_notes = updates.resolution_notes;
  if (updates.work_notes) payload.work_notes = updates.work_notes;
  if (updates.comments) payload.comments = updates.comments;

  const updateUrl = `${baseUrl}/${sysId}`;
  const updateRes = await fetch(updateUrl, {
    method: "PATCH",
    headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    return jsonRes({ success: false, error: `Update failed: ${updateRes.status}: ${text.slice(0, 200)}` }, updateRes.status);
  }

  const result = await updateRes.json();
  return jsonRes({ success: true, message: `Ticket ${ticketNumber} updated in ServiceNow`, result: result.result });
}

// ── Helpers ──

function buildAuth(config: any): string | null {
  if (config.authMethod === "bearer" && config.apiKey) {
    return `Bearer ${config.apiKey}`;
  } else if (config.username && config.password) {
    return `Basic ${btoa(`${config.username}:${config.password}`)}`;
  }
  return null;
}

function mapSnStatus(state: string): string {
  const s = String(state).toLowerCase();
  if (s === "1" || s === "new" || s === "open") return "Open";
  if (s === "2" || s === "in progress" || s === "active") return "In Progress";
  if (s === "6" || s === "resolved") return "Resolved";
  if (s === "7" || s === "closed") return "Closed";
  if (s === "3" || s === "on hold" || s === "pending") return "In Progress";
  return "Open";
}

function mapSnPriority(priority: string): string {
  const p = String(priority).toLowerCase();
  if (p === "1" || p.includes("critical")) return "Critical";
  if (p === "2" || p.includes("high")) return "High";
  if (p === "3" || p.includes("moderate") || p.includes("medium") || p.includes("normal")) return "Medium";
  if (p === "4" || p === "5" || p.includes("low")) return "Low";
  return "Medium";
}

function reverseMapStatus(status: string): string {
  switch (status) {
    case "Open": return "1";
    case "In Progress": return "2";
    case "Resolved": return "6";
    case "Closed": return "7";
    default: return "1";
  }
}

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
