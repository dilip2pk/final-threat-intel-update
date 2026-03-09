import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SAMPLE_SOFTWARE = [
  { id: "microsoft-edge-chromium", name: "Microsoft Edge", vendor: "Microsoft Corporation", version: "120.0.2210.91", latestVersion: "131.0.2903.86", installedMachines: 245, exposedMachines: 18, exposedVulnerabilities: 3, exposureScore: 7.8, publicExploit: true, category: "Browser", osPlatform: "Windows 10/11" },
  { id: "google-chrome", name: "Google Chrome", vendor: "Google LLC", version: "119.0.6045.199", latestVersion: "131.0.6778.85", installedMachines: 189, exposedMachines: 32, exposedVulnerabilities: 5, exposureScore: 8.3, publicExploit: true, category: "Browser", osPlatform: "Windows 10/11" },
  { id: "adobe-acrobat-reader", name: "Adobe Acrobat Reader DC", vendor: "Adobe Inc.", version: "23.006.20320", latestVersion: "24.004.20220", installedMachines: 312, exposedMachines: 89, exposedVulnerabilities: 12, exposureScore: 9.1, publicExploit: true, category: "Productivity", osPlatform: "Windows 10/11" },
  { id: "java-runtime", name: "Java Runtime Environment", vendor: "Oracle Corporation", version: "8.0.391", latestVersion: "8.0.432", installedMachines: 156, exposedMachines: 41, exposedVulnerabilities: 8, exposureScore: 8.7, publicExploit: true, category: "Runtime", osPlatform: "Windows/Linux" },
  { id: "winrar", name: "WinRAR", vendor: "RARLAB", version: "6.23", latestVersion: "7.01", installedMachines: 98, exposedMachines: 12, exposedVulnerabilities: 2, exposureScore: 6.2, publicExploit: false, category: "Utility", osPlatform: "Windows 10/11" },
  { id: "7zip", name: "7-Zip", vendor: "Igor Pavlov", version: "23.01", latestVersion: "24.08", installedMachines: 267, exposedMachines: 0, exposedVulnerabilities: 0, exposureScore: 1.2, publicExploit: false, category: "Utility", osPlatform: "Windows 10/11" },
  { id: "nodejs", name: "Node.js", vendor: "OpenJS Foundation", version: "18.17.1", latestVersion: "22.11.0", installedMachines: 87, exposedMachines: 23, exposedVulnerabilities: 4, exposureScore: 7.4, publicExploit: true, category: "Runtime", osPlatform: "Windows/Linux" },
  { id: "python", name: "Python", vendor: "Python Software Foundation", version: "3.11.4", latestVersion: "3.13.1", installedMachines: 134, exposedMachines: 8, exposedVulnerabilities: 1, exposureScore: 5.3, publicExploit: false, category: "Runtime", osPlatform: "Windows/Linux" },
  { id: "firefox", name: "Mozilla Firefox", vendor: "Mozilla Foundation", version: "121.0", latestVersion: "133.0", installedMachines: 92, exposedMachines: 15, exposedVulnerabilities: 2, exposureScore: 6.8, publicExploit: true, category: "Browser", osPlatform: "Windows 10/11" },
  { id: "zoom", name: "Zoom Client", vendor: "Zoom Video Communications", version: "5.16.10", latestVersion: "6.2.11", installedMachines: 423, exposedMachines: 0, exposedVulnerabilities: 0, exposureScore: 2.1, publicExploit: false, category: "Communication", osPlatform: "Windows/macOS" },
  { id: "slack", name: "Slack", vendor: "Slack Technologies", version: "4.35.121", latestVersion: "4.40.128", installedMachines: 289, exposedMachines: 5, exposedVulnerabilities: 1, exposureScore: 4.5, publicExploit: false, category: "Communication", osPlatform: "Windows/macOS" },
  { id: "docker-desktop", name: "Docker Desktop", vendor: "Docker Inc.", version: "4.25.2", latestVersion: "4.36.0", installedMachines: 76, exposedMachines: 9, exposedVulnerabilities: 3, exposureScore: 7.1, publicExploit: false, category: "DevOps", osPlatform: "Windows/macOS" },
  { id: "vscode", name: "Visual Studio Code", vendor: "Microsoft Corporation", version: "1.85.1", latestVersion: "1.95.3", installedMachines: 198, exposedMachines: 0, exposedVulnerabilities: 0, exposureScore: 1.8, publicExploit: false, category: "Development", osPlatform: "Windows/macOS/Linux" },
  { id: "cisco-anyconnect", name: "Cisco AnyConnect", vendor: "Cisco Systems", version: "4.10.06079", latestVersion: "5.1.4.74", installedMachines: 512, exposedMachines: 67, exposedVulnerabilities: 6, exposureScore: 8.5, publicExploit: true, category: "VPN/Security", osPlatform: "Windows/macOS" },
  { id: "microsoft-office", name: "Microsoft Office 365", vendor: "Microsoft Corporation", version: "16.0.17029.20028", latestVersion: "16.0.18129.20158", installedMachines: 634, exposedMachines: 45, exposedVulnerabilities: 4, exposureScore: 7.2, publicExploit: true, category: "Productivity", osPlatform: "Windows/macOS" },
];

const SAMPLE_MACHINES: Record<string, any[]> = {
  "adobe-acrobat-reader": [
    { deviceName: "DESKTOP-WKS-001", osVersion: "Windows 11 Pro 23H2", lastLoggedOnUser: "john.doe@company.com", exposureLevel: "High", cves: ["CVE-2023-44323", "CVE-2023-44324", "CVE-2023-44350"], deviceGroup: "Finance", lastSeen: "2024-12-15T09:30:00Z", criticalityLevel: "High", tags: ["PCI-DSS", "Finance"], ipAddress: "10.0.1.45", macAddress: "00:1A:2B:3C:4D:5E", domain: "CORP.LOCAL", primaryUser: "john.doe@company.com", firstSeen: "2023-06-12T08:00:00Z", healthState: "Active", installedVersion: "23.003.20201", isVulnerable: true, recommendedVersion: "24.004.20220" },
    { deviceName: "LAPTOP-HR-042", osVersion: "Windows 10 Enterprise 22H2", lastLoggedOnUser: "sarah.smith@company.com", exposureLevel: "High", cves: ["CVE-2023-44323"], deviceGroup: "HR", lastSeen: "2024-12-14T16:45:00Z", criticalityLevel: "High", tags: ["HR", "Sensitive-Data"], ipAddress: "10.0.2.89", macAddress: "00:2C:3D:4E:5F:6A", domain: "CORP.LOCAL", primaryUser: "sarah.smith@company.com", firstSeen: "2023-01-15T10:00:00Z", healthState: "Active", installedVersion: "23.003.20201", isVulnerable: true, recommendedVersion: "24.004.20220" },
    { deviceName: "DESKTOP-ENG-089", osVersion: "Windows 11 Pro 23H2", lastLoggedOnUser: "mike.johnson@company.com", exposureLevel: "Medium", cves: [], deviceGroup: "Engineering", lastSeen: "2024-12-15T11:20:00Z", criticalityLevel: "Normal", tags: ["Engineering"], ipAddress: "10.0.3.112", macAddress: "00:3E:4F:5A:6B:7C", domain: "CORP.LOCAL", primaryUser: "mike.johnson@company.com", firstSeen: "2023-09-01T08:30:00Z", healthState: "Active", installedVersion: "24.002.20736", isVulnerable: false, recommendedVersion: "24.004.20220" },
    { deviceName: "LAPTOP-FIN-023", osVersion: "Windows 11 Enterprise 23H2", lastLoggedOnUser: "emma.davis@company.com", exposureLevel: "High", cves: ["CVE-2023-44323", "CVE-2023-44324"], deviceGroup: "Finance", lastSeen: "2024-12-13T14:10:00Z", criticalityLevel: "High", tags: ["PCI-DSS", "Finance", "Executive"], ipAddress: "10.0.1.67", macAddress: "00:4A:5B:6C:7D:8E", domain: "CORP.LOCAL", primaryUser: "emma.davis@company.com", firstSeen: "2022-11-20T09:00:00Z", healthState: "Active", installedVersion: "23.001.20093", isVulnerable: true, recommendedVersion: "24.004.20220" },
  ],
  "google-chrome": [
    { deviceName: "LAPTOP-MKT-015", osVersion: "Windows 11 Pro 23H2", lastLoggedOnUser: "alice.williams@company.com", exposureLevel: "High", cves: ["CVE-2023-7024", "CVE-2023-6345"], deviceGroup: "Marketing", lastSeen: "2024-12-15T08:00:00Z", criticalityLevel: "Normal", tags: ["Marketing"], ipAddress: "10.0.4.33", macAddress: "00:5C:6D:7E:8F:9A", domain: "CORP.LOCAL", primaryUser: "alice.williams@company.com", firstSeen: "2023-03-10T07:45:00Z", healthState: "Active", installedVersion: "119.0.6045.199", isVulnerable: true, recommendedVersion: "131.0.6778.85" },
    { deviceName: "DESKTOP-IT-003", osVersion: "Windows 10 Pro 22H2", lastLoggedOnUser: "bob.anderson@company.com", exposureLevel: "Medium", cves: ["CVE-2023-7024"], deviceGroup: "IT", lastSeen: "2024-12-15T10:30:00Z", criticalityLevel: "Normal", tags: ["IT", "Admin"], ipAddress: "10.0.5.12", macAddress: "00:6E:7F:8A:9B:AC", domain: "CORP.LOCAL", primaryUser: "bob.anderson@company.com", firstSeen: "2022-08-05T11:00:00Z", healthState: "Active", installedVersion: "120.0.6099.109", isVulnerable: true, recommendedVersion: "131.0.6778.85" },
    { deviceName: "DESKTOP-SALES-044", osVersion: "Windows 11 Pro 23H2", lastLoggedOnUser: "carol.martinez@company.com", exposureLevel: "Low", cves: [], deviceGroup: "Sales", lastSeen: "2024-12-15T12:15:00Z", criticalityLevel: "Normal", tags: ["Sales"], ipAddress: "10.0.6.78", macAddress: "00:7A:8B:9C:AD:BE", domain: "CORP.LOCAL", primaryUser: "carol.martinez@company.com", firstSeen: "2024-01-15T09:00:00Z", healthState: "Active", installedVersion: "131.0.6778.85", isVulnerable: false, recommendedVersion: "131.0.6778.85" },
  ],
  "java-runtime": [
    { deviceName: "SERVER-APP-01", osVersion: "Windows Server 2019 DC", lastLoggedOnUser: "service.account@company.com", exposureLevel: "High", cves: ["CVE-2023-22081", "CVE-2023-22025", "CVE-2023-22067"], deviceGroup: "Servers", lastSeen: "2024-12-15T00:00:00Z", criticalityLevel: "High", tags: ["Production", "Critical-Infrastructure"], ipAddress: "10.1.0.10", macAddress: "00:8C:9D:AE:BF:C0", domain: "CORP.LOCAL", primaryUser: "service.account@company.com", firstSeen: "2021-03-01T00:00:00Z", healthState: "Active", installedVersion: "8.0.371", isVulnerable: true, recommendedVersion: "8.0.432" },
    { deviceName: "DESKTOP-DEV-056", osVersion: "Windows 11 Pro 23H2", lastLoggedOnUser: "dev.team@company.com", exposureLevel: "High", cves: ["CVE-2023-22081"], deviceGroup: "Development", lastSeen: "2024-12-14T18:00:00Z", criticalityLevel: "Normal", tags: ["Development"], ipAddress: "10.0.7.45", macAddress: "00:9E:AF:B0:C1:D2", domain: "CORP.LOCAL", primaryUser: "dev.team@company.com", firstSeen: "2023-07-20T08:00:00Z", healthState: "Active", installedVersion: "8.0.391", isVulnerable: true, recommendedVersion: "8.0.432" },
  ],
  "cisco-anyconnect": [
    { deviceName: "LAPTOP-SALES-021", osVersion: "Windows 11 Pro 23H2", lastLoggedOnUser: "sales.rep@company.com", exposureLevel: "High", cves: ["CVE-2023-20178", "CVE-2023-20240"], deviceGroup: "Sales", lastSeen: "2024-12-15T07:30:00Z", criticalityLevel: "Normal", tags: ["Sales", "Remote"], ipAddress: "10.0.8.90", macAddress: "00:A1:B2:C3:D4:E5", domain: "CORP.LOCAL", primaryUser: "sales.rep@company.com", firstSeen: "2023-02-10T09:00:00Z", healthState: "Active", installedVersion: "4.10.06079", isVulnerable: true, recommendedVersion: "5.1.4.74" },
    { deviceName: "DESKTOP-EXEC-001", osVersion: "Windows 11 Enterprise 23H2", lastLoggedOnUser: "ceo@company.com", exposureLevel: "Medium", cves: [], deviceGroup: "Executive", lastSeen: "2024-12-15T09:00:00Z", criticalityLevel: "High", tags: ["Executive", "VIP"], ipAddress: "10.0.0.5", macAddress: "00:B3:C4:D5:E6:F7", domain: "CORP.LOCAL", primaryUser: "ceo@company.com", firstSeen: "2022-01-05T08:00:00Z", healthState: "Active", installedVersion: "5.1.2.42", isVulnerable: false, recommendedVersion: "5.1.4.74" },
  ],
  "microsoft-office": [
    { deviceName: "LAPTOP-FIN-011", osVersion: "Windows 11 Pro 23H2", lastLoggedOnUser: "finance.lead@company.com", exposureLevel: "High", cves: ["CVE-2024-21413", "CVE-2024-21378"], deviceGroup: "Finance", lastSeen: "2024-12-15T08:45:00Z", criticalityLevel: "High", tags: ["Finance", "PCI-DSS"], ipAddress: "10.0.1.23", macAddress: "00:C5:D6:E7:F8:09", domain: "CORP.LOCAL", primaryUser: "finance.lead@company.com", firstSeen: "2022-06-15T08:00:00Z", healthState: "Active", installedVersion: "16.0.16924.20054", isVulnerable: true, recommendedVersion: "16.0.18129.20158" },
    { deviceName: "DESKTOP-HR-007", osVersion: "Windows 10 Enterprise 22H2", lastLoggedOnUser: "hr.manager@company.com", exposureLevel: "Medium", cves: ["CVE-2024-21413"], deviceGroup: "HR", lastSeen: "2024-12-14T17:30:00Z", criticalityLevel: "Normal", tags: ["HR"], ipAddress: "10.0.2.56", macAddress: "00:D7:E8:F9:0A:1B", domain: "CORP.LOCAL", primaryUser: "hr.manager@company.com", firstSeen: "2023-04-20T09:00:00Z", healthState: "Active", installedVersion: "16.0.17029.20028", isVulnerable: true, recommendedVersion: "16.0.18129.20158" },
  ],
};

const SAMPLE_RECOMMENDATIONS: Record<string, any[]> = {
  "adobe-acrobat-reader": [
    { id: "rec-1", title: "Update Adobe Acrobat Reader DC to version 24.004.20220", description: "Multiple critical vulnerabilities have been identified in versions prior to 24.004.20220 including remote code execution and privilege escalation flaws.", severity: "Critical", status: "Active", remediationType: "Update", affectedDevices: 89, relatedCves: ["CVE-2023-44323", "CVE-2023-44324", "CVE-2023-44350"], vendor: "Adobe Inc.", productName: "Adobe Acrobat Reader DC" },
    { id: "rec-2", title: "Restrict Adobe Acrobat Reader to authorized devices only", description: "Reduce attack surface by limiting installation to devices that require PDF processing capabilities.", severity: "Medium", status: "Active", remediationType: "Configuration", affectedDevices: 312, relatedCves: [], vendor: "Adobe Inc.", productName: "Adobe Acrobat Reader DC" },
    { id: "rec-3", title: "Disable JavaScript execution in Adobe Acrobat Reader", description: "Prevent exploitation of JavaScript-based vulnerabilities by disabling JS execution in Reader preferences.", severity: "High", status: "Active", remediationType: "Configuration", affectedDevices: 312, relatedCves: ["CVE-2023-44350"], vendor: "Adobe Inc.", productName: "Adobe Acrobat Reader DC" },
  ],
  "google-chrome": [
    { id: "rec-4", title: "Update Google Chrome to version 131.0.6778.85", description: "Critical zero-day vulnerabilities have been actively exploited in versions prior to 131.x. Immediate update is strongly recommended.", severity: "Critical", status: "Active", remediationType: "Update", affectedDevices: 32, relatedCves: ["CVE-2023-7024", "CVE-2023-6345"], vendor: "Google LLC", productName: "Google Chrome" },
    { id: "rec-5", title: "Enable Chrome auto-update policy via GPO", description: "Configure Group Policy to enforce automatic Chrome updates to prevent version drift.", severity: "Medium", status: "Active", remediationType: "Configuration", affectedDevices: 189, relatedCves: [], vendor: "Google LLC", productName: "Google Chrome" },
  ],
  "java-runtime": [
    { id: "rec-6", title: "Update Java Runtime Environment to version 8u432", description: "Multiple high-severity vulnerabilities exist in JRE versions prior to 8u432 including deserialization and remote code execution flaws.", severity: "Critical", status: "Active", remediationType: "Update", affectedDevices: 41, relatedCves: ["CVE-2023-22081", "CVE-2023-22025", "CVE-2023-22067"], vendor: "Oracle Corporation", productName: "Java Runtime Environment" },
    { id: "rec-7", title: "Remove unused Java installations", description: "Uninstall Java from devices that do not require it to reduce the attack surface.", severity: "High", status: "Active", remediationType: "Uninstall", affectedDevices: 156, relatedCves: [], vendor: "Oracle Corporation", productName: "Java Runtime Environment" },
  ],
  "cisco-anyconnect": [
    { id: "rec-8", title: "Upgrade Cisco AnyConnect to version 5.1.4.74", description: "Critical privilege escalation and arbitrary code execution vulnerabilities affect versions prior to 5.1.x.", severity: "Critical", status: "Active", remediationType: "Update", affectedDevices: 67, relatedCves: ["CVE-2023-20178", "CVE-2023-20240"], vendor: "Cisco Systems", productName: "Cisco AnyConnect" },
  ],
  "microsoft-office": [
    { id: "rec-9", title: "Update Microsoft Office 365 to latest build", description: "Critical Outlook and Word vulnerabilities allow remote code execution via crafted documents.", severity: "Critical", status: "Active", remediationType: "Update", affectedDevices: 45, relatedCves: ["CVE-2024-21413", "CVE-2024-21378"], vendor: "Microsoft Corporation", productName: "Microsoft Office 365" },
    { id: "rec-10", title: "Disable macros in Office documents from external sources", description: "Prevent macro-based malware by blocking macros in documents originating from the internet.", severity: "High", status: "Active", remediationType: "Configuration", affectedDevices: 634, relatedCves: [], vendor: "Microsoft Corporation", productName: "Microsoft Office 365" },
  ],
};

const SAMPLE_SOFTWARE_DETAIL: Record<string, any> = {
  "adobe-acrobat-reader": {
    weaknesses: { critical: 4, high: 5, medium: 2, low: 1 },
    exposedDeviceTrend: [78, 82, 85, 89, 87, 89],
    topEvents: [
      { event: "CVE-2023-44323 exploit detected", date: "2024-12-14", severity: "Critical" },
      { event: "New vulnerability CVE-2023-44350 published", date: "2024-12-10", severity: "High" },
      { event: "12 devices flagged as non-compliant", date: "2024-12-08", severity: "Medium" },
      { event: "Patch deployment initiated for Finance group", date: "2024-12-05", severity: "Info" },
    ],
    threatContext: { exploitAvailable: true, exploitVerified: true, exploitInKit: false, activeThreats: 2, threatSeverity: "Critical" },
    impactScore: 9.1,
  },
  "google-chrome": {
    weaknesses: { critical: 2, high: 2, medium: 1, low: 0 },
    exposedDeviceTrend: [25, 28, 30, 32, 31, 32],
    topEvents: [
      { event: "Zero-day CVE-2023-7024 actively exploited", date: "2024-12-12", severity: "Critical" },
      { event: "Emergency patch available", date: "2024-12-11", severity: "High" },
    ],
    threatContext: { exploitAvailable: true, exploitVerified: true, exploitInKit: true, activeThreats: 3, threatSeverity: "Critical" },
    impactScore: 8.3,
  },
};

const SAMPLE_MACHINE_DETAIL: Record<string, any> = {
  "DESKTOP-WKS-001": {
    category: "Endpoint", type: "Workstation", subtype: "Desktop",
    securityAssessments: { critical: 2, high: 3, medium: 5, low: 1 },
    loggedOnUsers: [
      { username: "john.doe@company.com", logonType: "Most frequent", lastLogon: "2024-12-15T09:30:00Z" },
      { username: "admin.local@company.com", logonType: "Least frequent", lastLogon: "2024-12-01T08:00:00Z" },
    ],
    deviceHealth: { lastFullScan: "2024-12-14T22:00:00Z", lastQuickScan: "2024-12-15T06:00:00Z", securityIntelligence: "1.403.1234.0", engineVersion: "1.1.24010.10", antivirusMode: "Active" },
  },
  "LAPTOP-HR-042": {
    category: "Endpoint", type: "Workstation", subtype: "Laptop",
    securityAssessments: { critical: 1, high: 2, medium: 3, low: 0 },
    loggedOnUsers: [
      { username: "sarah.smith@company.com", logonType: "Most frequent", lastLogon: "2024-12-14T16:45:00Z" },
    ],
    deviceHealth: { lastFullScan: "2024-12-13T23:00:00Z", lastQuickScan: "2024-12-14T12:00:00Z", securityIntelligence: "1.403.1230.0", engineVersion: "1.1.24010.10", antivirusMode: "Active" },
  },
  "SERVER-APP-01": {
    category: "Server", type: "Application Server", subtype: "Virtual",
    securityAssessments: { critical: 3, high: 4, medium: 2, low: 2 },
    loggedOnUsers: [
      { username: "service.account@company.com", logonType: "Most frequent", lastLogon: "2024-12-15T00:00:00Z" },
      { username: "sysadmin@company.com", logonType: "Newest", lastLogon: "2024-12-14T10:30:00Z" },
    ],
    deviceHealth: { lastFullScan: "2024-12-14T01:00:00Z", lastQuickScan: "2024-12-15T01:00:00Z", securityIntelligence: "1.403.1234.0", engineVersion: "1.1.24010.10", antivirusMode: "Active" },
  },
};

async function getDefenderToken(): Promise<string | null> {
  const tenantId = Deno.env.get("DEFENDER_TENANT_ID");
  const clientId = Deno.env.get("DEFENDER_CLIENT_ID");
  const clientSecret = Deno.env.get("DEFENDER_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) return null;

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
    const { action, softwareId, deviceName } = await req.json();
    const token = await getDefenderToken();

    // Demo mode
    if (!token) {
      if (action === "software-inventory") {
        return new Response(
          JSON.stringify({ success: true, software: SAMPLE_SOFTWARE, demoMode: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "software-machines" && softwareId) {
        const machines = SAMPLE_MACHINES[softwareId] || [
          { deviceName: "DEMO-DEVICE-001", osVersion: "Windows 11 Pro", lastLoggedOnUser: "demo.user@company.com", exposureLevel: "Low", cves: [], deviceGroup: "Demo", lastSeen: new Date().toISOString(), criticalityLevel: "Normal", tags: ["Demo"], ipAddress: "10.0.0.1", macAddress: "00:00:00:00:00:00", domain: "DEMO.LOCAL", primaryUser: "demo.user@company.com", firstSeen: "2024-01-01T00:00:00Z", healthState: "Active", installedVersion: "1.0.0", isVulnerable: false, recommendedVersion: "1.0.0" },
        ];
        return new Response(
          JSON.stringify({ success: true, machines, demoMode: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "software-detail" && softwareId) {
        const detail = SAMPLE_SOFTWARE_DETAIL[softwareId] || {
          weaknesses: { critical: 0, high: 0, medium: 0, low: 0 },
          exposedDeviceTrend: [0, 0, 0, 0, 0, 0],
          topEvents: [],
          threatContext: { exploitAvailable: false, exploitVerified: false, exploitInKit: false, activeThreats: 0, threatSeverity: "None" },
          impactScore: 0,
        };
        return new Response(
          JSON.stringify({ success: true, detail, demoMode: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "software-recommendations" && softwareId) {
        const recommendations = SAMPLE_RECOMMENDATIONS[softwareId] || [];
        return new Response(
          JSON.stringify({ success: true, recommendations, demoMode: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "machine-detail" && deviceName) {
        const detail = SAMPLE_MACHINE_DETAIL[deviceName] || {
          category: "Endpoint", type: "Unknown", subtype: "Unknown",
          securityAssessments: { critical: 0, high: 0, medium: 0, low: 0 },
          loggedOnUsers: [],
          deviceHealth: { lastFullScan: null, lastQuickScan: null, securityIntelligence: "N/A", engineVersion: "N/A", antivirusMode: "Unknown" },
        };
        return new Response(
          JSON.stringify({ success: true, detail, demoMode: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Live mode
    const baseUrl = "https://api.securitycenter.microsoft.com/api";

    if (action === "software-inventory") {
      const res = await fetch(`${baseUrl}/Software`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Defender API error [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      const software = (data.value || []).map((s: any) => ({
        id: s.id, name: s.name, vendor: s.vendor || "Unknown", version: s.version || "Unknown",
        installedMachines: s.installedMachines || 0, exposedMachines: s.exposedMachines || 0,
        exposedVulnerabilities: s.exposedVulnerabilities || 0, exposureScore: s.weaknesses || 0,
        publicExploit: s.publicExploit || false, category: s.softwareCategory || "Unknown",
        osPlatform: s.osPlatform || "Unknown",
      }));
      return new Response(JSON.stringify({ success: true, software }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "software-machines" && softwareId) {
      const res = await fetch(`${baseUrl}/Software/${encodeURIComponent(softwareId)}/machineReferences`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Defender API error [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      const machines = (data.value || []).map((m: any) => ({
        deviceName: m.computerDnsName || m.id, osVersion: m.osPlatform || "Unknown",
        lastLoggedOnUser: m.lastLoggedOnUser || "", exposureLevel: m.exposureLevel || "Low",
        cves: m.cveIds || [], deviceGroup: m.rbacGroupName || "Default",
        lastSeen: m.lastSeen || null, criticalityLevel: m.machineTags?.includes("Critical") ? "High" : "Normal",
        tags: m.machineTags || [], ipAddress: m.lastIpAddress || "", macAddress: m.lastExternalIpAddress || "",
        domain: m.domain || "", primaryUser: m.lastLoggedOnUser || "",
        firstSeen: m.firstSeen || null, healthState: m.healthStatus || "Unknown",
        installedVersion: m.installedVersion || "", isVulnerable: (m.cveIds || []).length > 0,
        recommendedVersion: "",
      }));
      return new Response(JSON.stringify({ success: true, machines }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "software-detail" && softwareId) {
      // Fetch vulnerabilities for the software
      const vulnRes = await fetch(`${baseUrl}/Software/${encodeURIComponent(softwareId)}/vulnerabilities`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      let weaknesses = { critical: 0, high: 0, medium: 0, low: 0 };
      if (vulnRes.ok) {
        const vulnData = await vulnRes.json();
        for (const v of (vulnData.value || [])) {
          const sev = (v.severity || "").toLowerCase();
          if (sev === "critical") weaknesses.critical++;
          else if (sev === "high") weaknesses.high++;
          else if (sev === "medium") weaknesses.medium++;
          else weaknesses.low++;
        }
      }

      // Fetch exposed machines count trend (use current count as last point)
      const machRes = await fetch(`${baseUrl}/Software/${encodeURIComponent(softwareId)}/machineReferences`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      let exposedCount = 0;
      if (machRes.ok) {
        const machData = await machRes.json();
        exposedCount = (machData.value || []).filter((m: any) => (m.cveIds || []).length > 0).length;
      }

      const detail = {
        weaknesses,
        exposedDeviceTrend: [0, 0, 0, 0, 0, exposedCount],
        topEvents: [],
        threatContext: {
          exploitAvailable: weaknesses.critical > 0,
          exploitVerified: false,
          exploitInKit: false,
          activeThreats: weaknesses.critical + weaknesses.high,
          threatSeverity: weaknesses.critical > 0 ? "Critical" : weaknesses.high > 0 ? "High" : "Low",
        },
        impactScore: Math.min(10, (weaknesses.critical * 3 + weaknesses.high * 2 + weaknesses.medium) / 2),
      };
      return new Response(JSON.stringify({ success: true, detail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "software-recommendations" && softwareId) {
      const res = await fetch(`${baseUrl}/recommendations?$filter=productName eq '${encodeURIComponent(softwareId)}'`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      let recommendations: any[] = [];
      if (res.ok) {
        const data = await res.json();
        recommendations = (data.value || []).map((r: any) => ({
          id: r.id,
          title: r.recommendationName || r.title || "Security Recommendation",
          description: r.description || "",
          severity: r.severityScore >= 9 ? "Critical" : r.severityScore >= 7 ? "High" : r.severityScore >= 4 ? "Medium" : "Low",
          status: r.status || "Active",
          remediationType: r.remediationType || "Update",
          affectedDevices: r.exposedMachinesCount || 0,
          relatedCves: r.relatedCves || [],
          vendor: r.vendor || "",
          productName: r.productName || softwareId,
        }));
      }
      // If no recommendations from API, generate a basic one
      if (recommendations.length === 0) {
        const sw = SAMPLE_SOFTWARE.find(s => s.id === softwareId);
        recommendations = [{
          id: `rec-live-${softwareId}`,
          title: `Update ${sw?.name || softwareId} to the latest version`,
          description: "Keep this software up to date to mitigate known vulnerabilities.",
          severity: "Medium",
          status: "Active",
          remediationType: "Update",
          affectedDevices: 0,
          relatedCves: [],
          vendor: sw?.vendor || "",
          productName: sw?.name || softwareId,
        }];
      }
      return new Response(JSON.stringify({ success: true, recommendations }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "machine-detail" && deviceName) {
      // Fetch machine info from Defender API
      const res = await fetch(`${baseUrl}/machines?$filter=computerDnsName eq '${encodeURIComponent(deviceName)}'`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      let detail: any = {
        category: "Endpoint", type: "Unknown", subtype: "Unknown",
        securityAssessments: { critical: 0, high: 0, medium: 0, low: 0 },
        loggedOnUsers: [],
        deviceHealth: { lastFullScan: null, lastQuickScan: null, securityIntelligence: "N/A", engineVersion: "N/A", antivirusMode: "Unknown" },
      };

      if (res.ok) {
        const data = await res.json();
        const machine = (data.value || [])[0];
        if (machine) {
          // Fetch vulnerabilities for this machine
          const vulnRes = await fetch(`${baseUrl}/machines/${machine.id}/vulnerabilities`, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          let securityAssessments = { critical: 0, high: 0, medium: 0, low: 0 };
          if (vulnRes.ok) {
            const vulnData = await vulnRes.json();
            for (const v of (vulnData.value || [])) {
              const sev = (v.severity || "").toLowerCase();
              if (sev === "critical") securityAssessments.critical++;
              else if (sev === "high") securityAssessments.high++;
              else if (sev === "medium") securityAssessments.medium++;
              else securityAssessments.low++;
            }
          }

          // Fetch logged on users
          const usersRes = await fetch(`${baseUrl}/machines/${machine.id}/logonusers`, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          let loggedOnUsers: any[] = [];
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            loggedOnUsers = (usersData.value || []).slice(0, 5).map((u: any) => ({
              username: u.accountName || u.userName || "Unknown",
              logonType: u.logonTypes || "Interactive",
              lastSeen: u.lastSeen || null,
            }));
          }

          detail = {
            category: machine.osPlatform?.includes("Server") ? "Server" : "Endpoint",
            type: machine.osPlatform || "Unknown",
            subtype: machine.osProcessor || "x64",
            securityAssessments,
            loggedOnUsers: loggedOnUsers.length > 0 ? loggedOnUsers : [
              { username: machine.lastLoggedOnUser || "Unknown", logonType: "Interactive", lastSeen: machine.lastSeen },
            ],
            deviceHealth: {
              lastFullScan: machine.lastFullScanTime || null,
              lastQuickScan: machine.lastQuickScanTime || null,
              securityIntelligence: machine.avSignatureVersion || "N/A",
              engineVersion: machine.avEngineVersion || "N/A",
              antivirusMode: machine.avIsActive ? "Active" : machine.avIsPassive ? "Passive" : "Unknown",
            },
          };
        }
      }
      return new Response(JSON.stringify({ success: true, detail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Defender proxy error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Defender API failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
