import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getDefenderToken(): Promise<string> {
  const tenantId = Deno.env.get("DEFENDER_TENANT_ID");
  const clientId = Deno.env.get("DEFENDER_CLIENT_ID");
  const clientSecret = Deno.env.get("DEFENDER_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Defender credentials not configured. Please add DEFENDER_TENANT_ID, DEFENDER_CLIENT_ID, and DEFENDER_CLIENT_SECRET in Settings.");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://api.securitycenter.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get Defender token: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, softwareId } = await req.json();

    const token = await getDefenderToken();
    const baseUrl = "https://api.securitycenter.microsoft.com/api";

    if (action === "software-inventory") {
      const res = await fetch(`${baseUrl}/Software`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Defender API error [${res.status}]: ${errText}`);
      }

      const data = await res.json();
      const software = (data.value || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        vendor: s.vendor || "Unknown",
        version: s.version || "Unknown",
        installedMachines: s.installedMachines || 0,
        exposedVulnerabilities: s.exposedVulnerabilities || 0,
        exposureScore: s.weaknesses || 0,
        publicExploit: s.publicExploit || false,
      }));

      return new Response(
        JSON.stringify({ success: true, software }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "software-machines" && softwareId) {
      const res = await fetch(`${baseUrl}/Software/${encodeURIComponent(softwareId)}/machineReferences`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Defender API error [${res.status}]: ${errText}`);
      }

      const data = await res.json();
      const machines = (data.value || []).map((m: any) => ({
        deviceName: m.computerDnsName || m.id,
        osVersion: m.osPlatform || "Unknown",
        lastLoggedOnUser: m.lastLoggedOnUser || "",
        exposureLevel: m.exposureLevel || "Low",
        cves: m.cveIds || [],
        deviceGroup: m.rbacGroupName || "Default",
      }));

      return new Response(
        JSON.stringify({ success: true, machines }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Defender proxy error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Defender API failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
