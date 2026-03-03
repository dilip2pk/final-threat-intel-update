import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ticket, serviceNowConfig } = await req.json();

    if (!ticket || !serviceNowConfig) {
      return new Response(JSON.stringify({ error: "Missing ticket data or ServiceNow configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instanceUrl, username, password, apiKey, authMethod, tableName, fieldMapping } = serviceNowConfig;

    if (!instanceUrl) {
      return new Response(JSON.stringify({ error: "Missing ServiceNow instance URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const table = tableName || "incident";
    const apiUrl = `${instanceUrl.replace(/\/$/, "")}/api/now/table/${table}`;

    // Build auth header
    let authHeader: string;
    if (authMethod === "bearer" && apiKey) {
      authHeader = `Bearer ${apiKey}`;
    } else if (username && password) {
      authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    } else {
      return new Response(JSON.stringify({ error: "Incomplete ServiceNow credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use field mapping if provided
    const fm = fieldMapping || { title: "short_description", description: "description", priority: "priority", category: "category" };

    const body: Record<string, string> = {
      [fm.title]: ticket.title,
      [fm.description]: ticket.description,
      impact: ticket.impact || "2",
      urgency: ticket.urgency || "2",
      [fm.category]: ticket.category || "Security",
      subcategory: ticket.subcategory || "Vulnerability",
      work_notes: ticket.workNotes || "",
      comments: ticket.comments || "",
    };

    console.log(`Creating ServiceNow ${table} at: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ServiceNow API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `ServiceNow API error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      ticketNumber: data.result?.number,
      sysId: data.result?.sys_id,
      message: `Ticket ${data.result?.number || ""} created successfully`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("servicenow-ticket error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Failed to create ticket" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
