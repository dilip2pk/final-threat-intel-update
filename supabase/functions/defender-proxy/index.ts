import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SAMPLE_SOFTWARE = [
  { id: "microsoft-edge-chromium", name: "Microsoft Edge", vendor: "Microsoft Corporation", version: "120.0.2210.91", installedMachines: 245, exposedVulnerabilities: 3, exposureScore: 7.8, publicExploit: true },
  { id: "google-chrome", name: "Google Chrome", vendor: "Google LLC", version: "119.0.6045.199", installedMachines: 189, exposedVulnerabilities: 5, exposureScore: 8.3, publicExploit: true },
  { id: "adobe-acrobat-reader", name: "Adobe Acrobat Reader DC", vendor: "Adobe Inc.", version: "23.006.20320", installedMachines: 312, exposedVulnerabilities: 12, exposureScore: 9.1, publicExploit: true },
  { id: "java-runtime", name: "Java Runtime Environment", vendor: "Oracle Corporation", version: "8.0.391", installedMachines: 156, exposedVulnerabilities: 8, exposureScore: 8.7, publicExploit: true },
  { id: "winrar", name: "WinRAR", vendor: "RARLAB", version: "6.23", installedMachines: 98, exposedVulnerabilities: 2, exposureScore: 6.2, publicExploit: false },
  { id: "7zip", name: "7-Zip", vendor: "Igor Pavlov", version: "23.01", installedMachines: 267, exposedVulnerabilities: 0, exposureScore: 1.2, publicExploit: false },
  { id: "nodejs", name: "Node.js", vendor: "OpenJS Foundation", version: "18.17.1", installedMachines: 87, exposedVulnerabilities: 4, exposureScore: 7.4, publicExploit: true },
  { id: "python", name: "Python", vendor: "Python Software Foundation", version: "3.11.4", installedMachines: 134, exposedVulnerabilities: 1, exposureScore: 5.3, publicExploit: false },
  { id: "firefox", name: "Mozilla Firefox", vendor: "Mozilla Foundation", version: "121.0", installedMachines: 92, exposedVulnerabilities: 2, exposureScore: 6.8, publicExploit: true },
  { id: "zoom", name: "Zoom Client", vendor: "Zoom Video Communications", version: "5.16.10", installedMachines: 423, exposedVulnerabilities: 0, exposureScore: 2.1, publicExploit: false },
  { id: "slack", name: "Slack", vendor: "Slack Technologies", version: "4.35.121", installedMachines: 289, exposedVulnerabilities: 1, exposureScore: 4.5, publicExploit: false },
  { id: "docker-desktop", name: "Docker Desktop", vendor: "Docker Inc.", version: "4.25.2", installedMachines: 76, exposedVulnerabilities: 3, exposureScore: 7.1, publicExploit: false },
  { id: "vscode", name: "Visual Studio Code", vendor: "Microsoft Corporation", version: "1.85.1", installedMachines: 198, exposedVulnerabilities: 0, exposureScore: 1.8, publicExploit: false },
  { id: "cisco-anyconnect", name: "Cisco AnyConnect", vendor: "Cisco Systems", version: "4.10.06079", installedMachines: 512, exposedVulnerabilities: 6, exposureScore: 8.5, publicExploit: true },
  { id: "microsoft-office", name: "Microsoft Office 365", vendor: "Microsoft Corporation", version: "16.0.17029.20028", installedMachines: 634, exposedVulnerabilities: 4, exposureScore: 7.2, publicExploit: true },
];

const SAMPLE_MACHINES: Record<string, any[]> = {
  "adobe-acrobat-reader": [
    { deviceName: "DESKTOP-WKS-001", osVersion: "Windows 11 Pro", lastLoggedOnUser: "john.doe@company.com", exposureLevel: "High", cves: ["CVE-2023-44323", "CVE-2023-44324"], deviceGroup: "Finance" },
    { deviceName: "LAPTOP-HR-042", osVersion: "Windows 10 Enterprise", lastLoggedOnUser: "sarah.smith@company.com", exposureLevel: "High", cves: ["CVE-2023-44323"], deviceGroup: "HR" },
    { deviceName: "DESKTOP-ENG-089", osVersion: "Windows 11 Pro", lastLoggedOnUser: "mike.johnson@company.com", exposureLevel: "Medium", cves: [], deviceGroup: "Engineering" },
  ],
  "google-chrome": [
    { deviceName: "LAPTOP-MKT-015", osVersion: "Windows 11 Pro", lastLoggedOnUser: "alice.williams@company.com", exposureLevel: "High", cves: ["CVE-2023-7024", "CVE-2023-6345"], deviceGroup: "Marketing" },
    { deviceName: "DESKTOP-IT-003", osVersion: "Windows 10 Pro", lastLoggedOnUser: "bob.anderson@company.com", exposureLevel: "Medium", cves: ["CVE-2023-7024"], deviceGroup: "IT" },
  ],
  "java-runtime": [
    { deviceName: "SERVER-APP-01", osVersion: "Windows Server 2019", lastLoggedOnUser: "service.account@company.com", exposureLevel: "High", cves: ["CVE-2023-22081", "CVE-2023-22025"], deviceGroup: "Servers" },
    { deviceName: "DESKTOP-DEV-056", osVersion: "Windows 11 Pro", lastLoggedOnUser: "dev.team@company.com", exposureLevel: "High", cves: ["CVE-2023-22081"], deviceGroup: "Development" },
  ],
  "cisco-anyconnect": [
    { deviceName: "LAPTOP-SALES-021", osVersion: "Windows 11 Pro", lastLoggedOnUser: "sales.rep@company.com", exposureLevel: "High", cves: ["CVE-2023-20178"], deviceGroup: "Sales" },
    { deviceName: "DESKTOP-EXEC-001", osVersion: "Windows 11 Enterprise", lastLoggedOnUser: "ceo@company.com", exposureLevel: "Medium", cves: [], deviceGroup: "Executive" },
  ],
};

async function getDefenderToken(): Promise<string | null> {
  const tenantId = Deno.env.get("DEFENDER_TENANT_ID");
  const clientId = Deno.env.get("DEFENDER_CLIENT_ID");
  const clientSecret = Deno.env.get("DEFENDER_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    return null; // Return null instead of throwing to enable demo mode
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
