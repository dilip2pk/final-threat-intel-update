import { useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Search, Loader2, Shield, Monitor, RefreshCw, AlertTriangle,
  User, Cpu, HardDrive, ChevronRight, Download, FileText, FileSpreadsheet, Trash2,
  ArrowLeft, Clock, Wifi, Activity, CheckCircle, XCircle, ShieldAlert, Info, Tag, Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SoftwareEntry {
  id: string;
  name: string;
  vendor: string;
  version: string;
  latestVersion?: string;
  installedMachines: number;
  exposedMachines?: number;
  exposedVulnerabilities: number;
  exposureScore: number;
  publicExploit: boolean;
  category?: string;
  osPlatform?: string;
}

interface MachineDetail {
  deviceName: string;
  osVersion: string;
  lastLoggedOnUser: string;
  exposureLevel: string;
  cves: string[];
  deviceGroup: string;
  lastSeen?: string;
  criticalityLevel?: string;
  tags?: string[];
  ipAddress?: string;
  macAddress?: string;
  domain?: string;
  primaryUser?: string;
  firstSeen?: string;
  healthState?: string;
  installedVersion?: string;
  isVulnerable?: boolean;
  recommendedVersion?: string;
}

interface SoftwareDetail {
  weaknesses: { critical: number; high: number; medium: number; low: number };
  exposedDeviceTrend: number[];
  topEvents: { event: string; date: string; severity: string }[];
  threatContext: { exploitAvailable: boolean; exploitVerified: boolean; exploitInKit: boolean; activeThreats: number; threatSeverity: string };
  impactScore: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  remediationType: string;
  affectedDevices: number;
  relatedCves: string[];
  vendor: string;
  productName: string;
}

interface MachineDetailExtra {
  category: string;
  type: string;
  subtype: string;
  securityAssessments: { critical: number; high: number; medium: number; low: number };
  loggedOnUsers: { username: string; logonType: string; lastLogon: string }[];
  deviceHealth: { lastFullScan: string | null; lastQuickScan: string | null; securityIntelligence: string; engineVersion: string; antivirusMode: string };
}

type ViewMode = "list" | "software-detail" | "machine-detail" | "affected-users";

interface AffectedUser {
  username: string;
  affectedSoftware: { name: string; installedVersion: string; recommendedVersion: string; cves: string[]; deviceName: string; exposureLevel: string }[];
}

export default function SoftwareInventory() {
  const [software, setSoftware] = useState<SoftwareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statFilter, setStatFilter] = useState<"all" | "vulnerable" | "exploits" | "high-exposure">("all");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareEntry | null>(null);
  const [machineDetails, setMachineDetails] = useState<MachineDetail[]>([]);
  const [machineLoading, setMachineLoading] = useState(false);
  const [softwareDetail, setSoftwareDetail] = useState<SoftwareDetail | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedMachine, setSelectedMachine] = useState<MachineDetail | null>(null);
  const [machineExtra, setMachineExtra] = useState<MachineDetailExtra | null>(null);
  const [machineExtraLoading, setMachineExtraLoading] = useState(false);

  const [affectedUsers, setAffectedUsers] = useState<AffectedUser[]>([]);
  const [affectedUsersLoading, setAffectedUsersLoading] = useState(false);
  const [affectedUserSearch, setAffectedUserSearch] = useState("");

  const { toast } = useToast();

  const fetchSoftwareInventory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("defender-proxy", { body: { action: "software-inventory" } });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      setSoftware(data.software || []);
      toast({ title: "Inventory Loaded", description: `${data.software?.length || 0} software entries found` });
    } catch (e: any) {
      toast({ title: "Fetch Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const openSoftwareDetail = useCallback(async (sw: SoftwareEntry) => {
    setSelectedSoftware(sw);
    setViewMode("software-detail");
    setMachineLoading(true);
    setDetailLoading(true);

    try {
      const [machinesRes, detailRes, recsRes] = await Promise.all([
        supabase.functions.invoke("defender-proxy", { body: { action: "software-machines", softwareId: sw.id } }),
        supabase.functions.invoke("defender-proxy", { body: { action: "software-detail", softwareId: sw.id } }),
        supabase.functions.invoke("defender-proxy", { body: { action: "software-recommendations", softwareId: sw.id } }),
      ]);
      setMachineDetails(machinesRes.data?.machines || []);
      setSoftwareDetail(detailRes.data?.detail || null);
      setRecommendations(recsRes.data?.recommendations || []);
    } catch (e: any) {
      toast({ title: "Fetch Failed", description: e.message, variant: "destructive" });
    } finally {
      setMachineLoading(false);
      setDetailLoading(false);
    }
  }, [toast]);

  const openMachineDetail = useCallback(async (machine: MachineDetail) => {
    setSelectedMachine(machine);
    setViewMode("machine-detail");
    setMachineExtraLoading(true);
    try {
      const { data } = await supabase.functions.invoke("defender-proxy", { body: { action: "machine-detail", deviceName: machine.deviceName } });
      setMachineExtra(data?.detail || null);
    } catch {
      /* silent */
    } finally {
      setMachineExtraLoading(false);
    }
  }, []);

  const goBack = () => {
    if (viewMode === "machine-detail") {
      setViewMode("software-detail");
      setSelectedMachine(null);
      setMachineExtra(null);
    } else {
      setViewMode("list");
      setSelectedSoftware(null);
    }
  };

  const clearData = useCallback(() => {
    setSoftware([]);
    setStatFilter("all");
    setSearch("");
    setSeverityFilter("all");
    setViewMode("list");
    toast({ title: "Data Cleared", description: "Software inventory has been removed" });
  }, [toast]);

  const filteredSoftware = useMemo(() => {
    return software.filter(s => {
      if (statFilter === "vulnerable" && s.exposedVulnerabilities <= 0) return false;
      if (statFilter === "exploits" && !s.publicExploit) return false;
      if (statFilter === "high-exposure" && s.exposureScore < 5) return false;
      if (search && search.trim()) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.vendor.toLowerCase().includes(q)) return false;
      }
      if (severityFilter !== "all") {
        if (severityFilter === "critical" && s.exposureScore < 8) return false;
        if (severityFilter === "high" && (s.exposureScore < 5 || s.exposureScore >= 8)) return false;
        if (severityFilter === "medium" && (s.exposureScore < 2 || s.exposureScore >= 5)) return false;
        if (severityFilter === "low" && s.exposureScore >= 2) return false;
      }
      return true;
    });
  }, [software, search, severityFilter, statFilter]);

  const exposureColor = (score: number) => {
    if (score >= 8) return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
    if (score >= 5) return "bg-severity-high/15 text-severity-high border-severity-high/30";
    if (score >= 2) return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
    return "bg-severity-low/15 text-severity-low border-severity-low/30";
  };

  const criticalityColor = (level: string) => {
    if (level === "High") return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
    if (level === "Medium") return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const severityColor = (sev: string) => {
    if (sev === "Critical") return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
    if (sev === "High") return "bg-severity-high/15 text-severity-high border-severity-high/30";
    if (sev === "Medium") return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
    if (sev === "Low") return "bg-severity-low/15 text-severity-low border-severity-low/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const formatDate = (d?: string | null) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // ─── Export Functions ───
  const exportToCSV = () => {
    const headers = ["Software Name", "Vendor", "Version", "Installed Machines", "Vulnerabilities", "Exposure Score", "Public Exploit"];
    const rows = filteredSoftware.map(s => [s.name, s.vendor, s.version, s.installedMachines, s.exposedVulnerabilities, s.exposureScore.toFixed(1), s.publicExploit ? "Yes" : "No"]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "CSV file downloaded" });
  };

  const exportToTXT = () => {
    let content = `SOFTWARE INVENTORY REPORT\nGenerated: ${new Date().toLocaleString()}\nTotal: ${filteredSoftware.length}\n${"=".repeat(80)}\n\n`;
    filteredSoftware.forEach((s, i) => {
      content += `${i + 1}. ${s.name}\n   Vendor: ${s.vendor}\n   Version: ${s.version}\n   Machines: ${s.installedMachines}\n   Vulns: ${s.exposedVulnerabilities}\n   Score: ${s.exposureScore.toFixed(1)}\n   Exploit: ${s.publicExploit ? "Yes" : "No"}\n\n`;
    });
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-inventory-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "TXT file downloaded" });
  };

  const exportToHTML = () => {
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Software Inventory</title><style>body{font-family:Arial;margin:20px;background:#f5f5f5}h1{color:#333;border-bottom:3px solid #0066cc;padding-bottom:10px}table{width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.1)}th{background:#0066cc;color:#fff;padding:12px;text-align:left}td{padding:10px;border-bottom:1px solid #ddd}tr:hover{background:#f9f9f9}</style></head><body><h1>Software Inventory Report</h1><p>Generated: ${new Date().toLocaleString()} | Total: ${filteredSoftware.length}</p><table><thead><tr><th>Software</th><th>Vendor</th><th>Version</th><th>Machines</th><th>Vulns</th><th>Score</th><th>Exploit</th></tr></thead><tbody>`;
    filteredSoftware.forEach(s => {
      html += `<tr><td><strong>${s.name}</strong></td><td>${s.vendor}</td><td><code>${s.version}</code></td><td>${s.installedMachines}</td><td>${s.exposedVulnerabilities}</td><td>${s.exposureScore.toFixed(1)}</td><td>${s.publicExploit ? "Yes" : "No"}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-inventory-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "HTML file downloaded" });
  };

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.setTextColor(0, 102, 204);
      doc.text("Software Inventory Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`Total: ${filteredSoftware.length}`, 14, 36);
      autoTable(doc, {
        head: [["Software", "Vendor", "Version", "Machines", "Vulns", "Score", "Exploit"]],
        body: filteredSoftware.map(s => [s.name, s.vendor, s.version, s.installedMachines, s.exposedVulnerabilities, s.exposureScore.toFixed(1), s.publicExploit ? "Yes" : "No"]),
        startY: 44,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [0, 102, 204] },
      });
      doc.save(`software-inventory-${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "Exported", description: "PDF file downloaded" });
    } catch {
      toast({ title: "Export Failed", description: "Could not generate PDF", variant: "destructive" });
    }
  };

  // ─── Vulnerability severity bar ───
  const SeverityBar = ({ data }: { data: { critical: number; high: number; medium: number; low: number } }) => {
    const total = data.critical + data.high + data.medium + data.low;
    if (total === 0) return <div className="text-xs text-muted-foreground">No weaknesses</div>;
    return (
      <div className="space-y-1.5">
        <div className="flex h-3 w-full rounded-full overflow-hidden">
          {data.critical > 0 && <div className="bg-severity-critical" style={{ width: `${(data.critical / total) * 100}%` }} />}
          {data.high > 0 && <div className="bg-severity-high" style={{ width: `${(data.high / total) * 100}%` }} />}
          {data.medium > 0 && <div className="bg-severity-medium" style={{ width: `${(data.medium / total) * 100}%` }} />}
          {data.low > 0 && <div className="bg-severity-low" style={{ width: `${(data.low / total) * 100}%` }} />}
        </div>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {data.critical > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-severity-critical" />{data.critical} Critical</span>}
          {data.high > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-severity-high" />{data.high} High</span>}
          {data.medium > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-severity-medium" />{data.medium} Medium</span>}
          {data.low > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-severity-low" />{data.low} Low</span>}
        </div>
      </div>
    );
  };

  // ─── Machine Detail View ───
  if (viewMode === "machine-detail" && selectedMachine) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={goBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />{selectedMachine.deviceName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={criticalityColor(selectedMachine.criticalityLevel || "Normal")}>
                  {selectedMachine.criticalityLevel || "Normal"} Criticality
                </Badge>
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                  {selectedMachine.healthState || "Active"}
                </Badge>
              </div>
            </div>
          </div>

          {machineExtraLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* VM Details */}
              <Card className="border-border">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" />VM Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["Category", machineExtra?.category],
                    ["Type", machineExtra?.type],
                    ["Subtype", machineExtra?.subtype],
                    ["Primary User", selectedMachine.primaryUser],
                    ["Domain", selectedMachine.domain],
                    ["OS", selectedMachine.osVersion],
                    ["Health State", selectedMachine.healthState],
                    ["IP Address", selectedMachine.ipAddress],
                    ["MAC Address", selectedMachine.macAddress],
                    ["First Seen", formatDate(selectedMachine.firstSeen)],
                    ["Last Seen", formatDate(selectedMachine.lastSeen)],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between border-b border-border/50 pb-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{value || "N/A"}</span>
                    </div>
                  ))}
                  {selectedMachine.tags && selectedMachine.tags.length > 0 && (
                    <div className="flex justify-between pt-1">
                      <span className="text-muted-foreground">Tags</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {selectedMachine.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</Badge>)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Assessments */}
              <Card className="border-border">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Security Assessments</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-muted-foreground">Exposure Level</span>
                      <Badge variant="outline" className={exposureColor(selectedMachine.exposureLevel === "High" ? 8 : selectedMachine.exposureLevel === "Medium" ? 5 : 1)}>
                        {selectedMachine.exposureLevel}
                      </Badge>
                    </div>
                    {machineExtra && <SeverityBar data={machineExtra.securityAssessments} />}
                  </div>
                  {selectedMachine.cves.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Associated CVEs</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedMachine.cves.map(c => <Badge key={c} variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">{c}</Badge>)}
                      </div>
                    </div>
                  )}
                  {selectedMachine.isVulnerable && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
                      <div className="flex items-center gap-2 text-destructive text-sm font-medium"><AlertTriangle className="h-4 w-4" />Vulnerable Version Detected</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Installed: <span className="font-mono text-foreground">{selectedMachine.installedVersion}</span>
                        {selectedMachine.recommendedVersion && <> → Recommended: <span className="font-mono text-foreground">{selectedMachine.recommendedVersion}</span></>}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Logged On Users */}
              <Card className="border-border">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-primary" />Logged On Users</CardTitle></CardHeader>
                <CardContent>
                  {machineExtra?.loggedOnUsers && machineExtra.loggedOnUsers.length > 0 ? (
                    <div className="space-y-3">
                      {machineExtra.loggedOnUsers.map((u, i) => (
                        <div key={i} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-foreground">{u.username}</p>
                            <p className="text-xs text-muted-foreground">{u.logonType}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(u.lastLogon)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No user logon data</p>
                  )}
                </CardContent>
              </Card>

              {/* Device Health */}
              <Card className="border-border">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Device Health</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {machineExtra?.deviceHealth ? (
                    <>
                      {[
                        ["Last Full Scan", formatDate(machineExtra.deviceHealth.lastFullScan)],
                        ["Last Quick Scan", formatDate(machineExtra.deviceHealth.lastQuickScan)],
                        ["Security Intelligence", machineExtra.deviceHealth.securityIntelligence],
                        ["Engine Version", machineExtra.deviceHealth.engineVersion],
                        ["Antivirus Mode", machineExtra.deviceHealth.antivirusMode],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between border-b border-border/50 pb-1.5">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium text-foreground flex items-center gap-1">
                            {label === "Antivirus Mode" && value === "Active" && <CheckCircle className="h-3 w-3 text-severity-low" />}
                            {value}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No health data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ─── Software Detail View ───
  if (viewMode === "software-detail" && selectedSoftware) {
    const vulnerableUsers = machineDetails.filter(m => m.isVulnerable);
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={goBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{selectedSoftware.name}</h1>
              <p className="text-sm text-muted-foreground">{selectedSoftware.vendor} · v{selectedSoftware.version} · {selectedSoftware.category || "Software"}</p>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="devices">Devices & Components ({machineDetails.length})</TabsTrigger>
              <TabsTrigger value="recommendations">Security Recommendations ({recommendations.length})</TabsTrigger>
            </TabsList>

            {/* ─── Overview Tab ─── */}
            <TabsContent value="overview" className="space-y-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  {/* Entity summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: "Vendor", value: selectedSoftware.vendor, icon: Globe },
                      { label: "OS Platform", value: selectedSoftware.osPlatform || "N/A", icon: Monitor },
                      { label: "Detected Devices", value: selectedSoftware.installedMachines, icon: HardDrive },
                      { label: "Exposed Devices", value: selectedSoftware.exposedMachines || 0, icon: AlertTriangle },
                      { label: "Impact Score", value: softwareDetail?.impactScore?.toFixed(1) || selectedSoftware.exposureScore.toFixed(1), icon: Shield },
                    ].map(item => (
                      <Card key={item.label} className="border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <item.icon className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                          </div>
                          <span className="text-lg font-bold font-mono text-foreground">{item.value}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Discovered Weaknesses */}
                    <Card className="border-border">
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Discovered Weaknesses</CardTitle></CardHeader>
                      <CardContent>
                        {softwareDetail ? <SeverityBar data={softwareDetail.weaknesses} /> : <p className="text-sm text-muted-foreground">No data</p>}
                      </CardContent>
                    </Card>

                    {/* Threat Context */}
                    <Card className="border-border">
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Threat Context</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {softwareDetail?.threatContext ? (
                          <>
                            {[
                              { label: "Exploit Available", value: softwareDetail.threatContext.exploitAvailable },
                              { label: "Exploit Verified", value: softwareDetail.threatContext.exploitVerified },
                              { label: "In Exploit Kit", value: softwareDetail.threatContext.exploitInKit },
                            ].map(item => (
                              <div key={item.label} className="flex items-center justify-between">
                                <span className="text-muted-foreground">{item.label}</span>
                                {item.value ? <CheckCircle className="h-4 w-4 text-severity-critical" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
                              </div>
                            ))}
                            <div className="flex items-center justify-between pt-1 border-t border-border/50">
                              <span className="text-muted-foreground">Active Threats</span>
                              <Badge variant="outline" className={severityColor(softwareDetail.threatContext.threatSeverity)}>
                                {softwareDetail.threatContext.activeThreats}
                              </Badge>
                            </div>
                          </>
                        ) : <p className="text-muted-foreground">No data</p>}
                      </CardContent>
                    </Card>

                    {/* Top Events */}
                    <Card className="border-border lg:col-span-2">
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Events</CardTitle></CardHeader>
                      <CardContent>
                        {softwareDetail?.topEvents && softwareDetail.topEvents.length > 0 ? (
                          <div className="space-y-2">
                            {softwareDetail.topEvents.map((ev, i) => (
                              <div key={i} className="flex items-center gap-3 border-b border-border/50 pb-2 last:border-0">
                                <Badge variant="outline" className={`text-[10px] ${severityColor(ev.severity)}`}>{ev.severity}</Badge>
                                <span className="text-sm text-foreground flex-1">{ev.event}</span>
                                <span className="text-xs text-muted-foreground">{ev.date}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-sm text-muted-foreground">No recent events</p>}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Exposed Devices Trend */}
                  {softwareDetail?.exposedDeviceTrend && softwareDetail.exposedDeviceTrend.length > 0 && (
                    <Card className="border-border">
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Exposed Devices Trend (Last 6 periods)</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-1 h-16">
                          {softwareDetail.exposedDeviceTrend.map((v, i) => {
                            const max = Math.max(...softwareDetail.exposedDeviceTrend);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(v / max) * 100}%` }} />
                                <span className="text-[9px] text-muted-foreground">{v}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* ─── Devices & Components Tab ─── */}
            <TabsContent value="devices" className="space-y-4">
              {/* Vulnerable Users Summary */}
              {vulnerableUsers.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="h-5 w-5 text-destructive" />
                      <h3 className="text-sm font-semibold text-destructive">{vulnerableUsers.length} Vulnerable User{vulnerableUsers.length > 1 ? "s" : ""} Detected</h3>
                    </div>
                    <div className="space-y-2">
                      {vulnerableUsers.slice(0, 5).map((m, i) => (
                        <div key={i} className="flex items-center justify-between bg-card/80 rounded-md px-3 py-2 border border-border">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-sm font-medium text-foreground">{m.primaryUser || m.lastLoggedOnUser}</span>
                            <span className="text-xs text-muted-foreground">on {m.deviceName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground">v{m.installedVersion}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-mono text-severity-low">v{m.recommendedVersion}</span>
                            {m.cves.length > 0 && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">{m.cves.length} CVE{m.cves.length > 1 ? "s" : ""}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {machineLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : machineDetails.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No device data available</div>
              ) : (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Device</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">OS</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Primary User</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Last Seen</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Criticality</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {machineDetails.map((m, idx) => (
                        <tr key={idx} onClick={() => openMachineDetail(m)} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-3.5 w-3.5 text-primary" />
                              <div>
                                <p className="font-medium text-foreground">{m.deviceName}</p>
                                <p className="text-xs text-muted-foreground">{m.deviceGroup}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{m.osVersion}</td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-foreground">{m.primaryUser || m.lastLoggedOnUser || "N/A"}</span>
                              {m.isVulnerable && <AlertTriangle className="h-3 w-3 text-destructive" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{formatDate(m.lastSeen)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${criticalityColor(m.criticalityLevel || "Normal")}`}>
                              {m.criticalityLevel || "Normal"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {m.isVulnerable ? (
                              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">Vulnerable</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-severity-low/15 text-severity-low border-severity-low/30">Secure</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ─── Security Recommendations Tab ─── */}
            <TabsContent value="recommendations" className="space-y-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No recommendations available</div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map(rec => (
                    <Card key={rec.id} className="border-border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-[10px] ${severityColor(rec.severity)}`}>{rec.severity}</Badge>
                              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">{rec.remediationType}</Badge>
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">{rec.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{rec.affectedDevices} affected devices</span>
                          <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{rec.status}</span>
                        </div>
                        {rec.relatedCves.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {rec.relatedCves.map(cve => (
                              <Badge key={cve} variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">{cve}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    );
  }

  // ─── Software List View ───
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Software Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">Vulnerability Management — Software & Device Tracking</p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF} className="gap-2"><FileText className="h-4 w-4" />PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} className="gap-2"><FileSpreadsheet className="h-4 w-4" />CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToHTML} className="gap-2"><FileText className="h-4 w-4" />HTML</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToTXT} className="gap-2"><FileText className="h-4 w-4" />TXT</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {software.length > 0 && (
              <Button onClick={clearData} variant="outline" className="gap-2"><Trash2 className="h-4 w-4" />Clear</Button>
            )}
            <Button onClick={fetchSoftwareInventory} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {software.length > 0 ? "Refresh" : "Fetch Inventory"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        {software.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: "all" as const, label: "Total Software", icon: HardDrive, color: "text-primary", value: software.length, ring: "ring-primary" },
              { key: "vulnerable" as const, label: "Vulnerable", icon: AlertTriangle, color: "text-severity-critical", value: software.filter(s => s.exposedVulnerabilities > 0).length, ring: "ring-severity-critical" },
              { key: "exploits" as const, label: "Public Exploits", icon: Shield, color: "text-severity-high", value: software.filter(s => s.publicExploit).length, ring: "ring-severity-high" },
              { key: "high-exposure" as const, label: "High Exposure", icon: Monitor, color: "text-severity-medium", value: software.filter(s => s.exposureScore >= 5).length, ring: "ring-severity-medium" },
            ].map(item => (
              <div key={item.key} onClick={() => setStatFilter(statFilter === item.key ? "all" : item.key)}
                className={`border rounded-md bg-card p-4 cursor-pointer transition-all hover:shadow-md ${statFilter === item.key ? `ring-2 ${item.ring}` : "border-border"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <span className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or vendor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-full md:w-40 bg-card"><SelectValue placeholder="Exposure" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="critical">Critical (≥8)</SelectItem>
              <SelectItem value="high">High (5-7)</SelectItem>
              <SelectItem value="medium">Medium (2-4)</SelectItem>
              <SelectItem value="low">Low (&lt;2)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Software List */}
        {software.length === 0 && !loading ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Click "Fetch Inventory" to load software data</p>
            <p className="text-xs mt-1">Requires API key configuration in Settings</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Fetching software inventory...</span>
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Software</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Version</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Machines</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vulns</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Exposure</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Exploit</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSoftware.map(sw => (
                  <tr key={sw.id} onClick={() => openSoftwareDetail(sw)} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{sw.name}</p>
                      <p className="text-xs text-muted-foreground">{sw.vendor}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{sw.version}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{sw.installedMachines}</td>
                    <td className="px-4 py-3 text-center">
                      {sw.exposedVulnerabilities > 0 ? (
                        <Badge variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">{sw.exposedVulnerabilities}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={`text-[10px] font-mono ${exposureColor(sw.exposureScore)}`}>{sw.exposureScore.toFixed(1)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {sw.publicExploit ? <AlertTriangle className="h-3.5 w-3.5 text-severity-critical mx-auto" /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
