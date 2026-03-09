import { useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Search, Loader2, Shield, Monitor, RefreshCw, AlertTriangle,
  User, Cpu, HardDrive, ChevronRight, Download, FileText, FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SoftwareEntry {
  id: string;
  name: string;
  vendor: string;
  version: string;
  installedMachines: number;
  exposedVulnerabilities: number;
  exposureScore: number;
  publicExploit: boolean;
}

interface MachineDetail {
  deviceName: string;
  osVersion: string;
  lastLoggedOnUser: string;
  exposureLevel: string;
  cves: string[];
  deviceGroup: string;
}

export default function SoftwareInventory() {
  const [software, setSoftware] = useState<SoftwareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statFilter, setStatFilter] = useState<"all" | "vulnerable" | "exploits" | "high-exposure">("all");
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareEntry | null>(null);
  const [machineDetails, setMachineDetails] = useState<MachineDetail[]>([]);
  const [machineLoading, setMachineLoading] = useState(false);
  const { toast } = useToast();

  const fetchSoftwareInventory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("defender-proxy", {
        body: { action: "software-inventory" },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to fetch software inventory");
      setSoftware(data.software || []);
      toast({ title: "Inventory Loaded", description: `${data.software?.length || 0} software entries found` });
    } catch (e: any) {
      toast({ title: "Fetch Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMachineDetails = useCallback(async (softwareId: string) => {
    setMachineLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("defender-proxy", {
        body: { action: "software-machines", softwareId },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to fetch machine details");
      setMachineDetails(data.machines || []);
    } catch (e: any) {
      toast({ title: "Fetch Failed", description: e.message, variant: "destructive" });
    } finally {
      setMachineLoading(false);
    }
  }, [toast]);

  const handleSelectSoftware = (sw: SoftwareEntry) => {
    setSelectedSoftware(sw);
    fetchMachineDetails(sw.id);
  };

  const filteredSoftware = useMemo(() => {
    return software.filter(s => {
      // Stat card filter
      if (statFilter === "vulnerable" && s.exposedVulnerabilities <= 0) return false;
      if (statFilter === "exploits" && !s.publicExploit) return false;
      if (statFilter === "high-exposure" && s.exposureScore < 5) return false;

      // Search filter
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = s.name.toLowerCase().includes(q);
        const vendorMatch = s.vendor.toLowerCase().includes(q);
        if (!nameMatch && !vendorMatch) return false;
      }
      
      // Severity filter
      if (severityFilter !== "all") {
        if (severityFilter === "critical" && s.exposureScore < 8) return false;
        if (severityFilter === "high" && (s.exposureScore < 5 || s.exposureScore >= 8)) return false;
        if (severityFilter === "medium" && (s.exposureScore < 2 || s.exposureScore >= 5)) return false;
        if (severityFilter === "low" && s.exposureScore >= 2) return false;
      }
      
      return true;
    });
  }, [software, search, severityFilter, statFilter]);

  const exportToCSV = () => {
    const headers = ["Software Name", "Vendor", "Version", "Installed Machines", "Vulnerabilities", "Exposure Score", "Public Exploit"];
    const rows = filteredSoftware.map(s => [
      s.name,
      s.vendor,
      s.version,
      s.installedMachines,
      s.exposedVulnerabilities,
      s.exposureScore.toFixed(1),
      s.publicExploit ? "Yes" : "No"
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "CSV file downloaded successfully" });
  };

  const exportToTXT = () => {
    let content = "SOFTWARE INVENTORY REPORT\n";
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Total Software: ${filteredSoftware.length}\n\n`;
    content += "=".repeat(80) + "\n\n";
    
    filteredSoftware.forEach((s, idx) => {
      content += `${idx + 1}. ${s.name}\n`;
      content += `   Vendor: ${s.vendor}\n`;
      content += `   Version: ${s.version}\n`;
      content += `   Installed Machines: ${s.installedMachines}\n`;
      content += `   Vulnerabilities: ${s.exposedVulnerabilities}\n`;
      content += `   Exposure Score: ${s.exposureScore.toFixed(1)}\n`;
      content += `   Public Exploit: ${s.publicExploit ? "Yes" : "No"}\n\n`;
    });
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-inventory-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "TXT file downloaded successfully" });
  };

  const exportToHTML = () => {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Software Inventory Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th { background: #0066cc; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f9f9f9; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .critical { background: #fee; color: #c00; }
    .high { background: #ffebe6; color: #ff4d00; }
    .medium { background: #fff4e6; color: #ff9800; }
    .low { background: #e8f5e9; color: #4caf50; }
  </style>
</head>
<body>
  <h1>Software Inventory Report</h1>
  <div class="meta">
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Software:</strong> ${filteredSoftware.length}</p>
    <p><strong>Vulnerable Software:</strong> ${filteredSoftware.filter(s => s.exposedVulnerabilities > 0).length}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Software</th>
        <th>Vendor</th>
        <th>Version</th>
        <th>Machines</th>
        <th>Vulnerabilities</th>
        <th>Exposure Score</th>
        <th>Public Exploit</th>
      </tr>
    </thead>
    <tbody>`;
    
    filteredSoftware.forEach(s => {
      const severityClass = s.exposureScore >= 8 ? "critical" : s.exposureScore >= 5 ? "high" : s.exposureScore >= 2 ? "medium" : "low";
      html += `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.vendor}</td>
        <td><code>${s.version}</code></td>
        <td>${s.installedMachines}</td>
        <td>${s.exposedVulnerabilities > 0 ? `<span class="badge critical">${s.exposedVulnerabilities}</span>` : "—"}</td>
        <td><span class="badge ${severityClass}">${s.exposureScore.toFixed(1)}</span></td>
        <td>${s.publicExploit ? "✓ Yes" : "✗ No"}</td>
      </tr>`;
    });
    
    html += `
    </tbody>
  </table>
</body>
</html>`;
    
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-inventory-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "HTML file downloaded successfully" });
  };

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.setTextColor(0, 102, 204);
      doc.text("Software Inventory Report", 14, 20);
      
      // Metadata
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`Total Software: ${filteredSoftware.length}`, 14, 36);
      doc.text(`Vulnerable: ${filteredSoftware.filter(s => s.exposedVulnerabilities > 0).length}`, 14, 42);
      
      // Table
      const tableData = filteredSoftware.map(s => [
        s.name,
        s.vendor,
        s.version,
        s.installedMachines,
        s.exposedVulnerabilities,
        s.exposureScore.toFixed(1),
        s.publicExploit ? "Yes" : "No"
      ]);
      
      autoTable(doc, {
        head: [["Software", "Vendor", "Version", "Machines", "Vulns", "Score", "Exploit"]],
        body: tableData,
        startY: 50,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [0, 102, 204] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
      
      doc.save(`software-inventory-${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "Exported", description: "PDF file downloaded successfully" });
    } catch (error) {
      toast({ title: "Export Failed", description: "Could not generate PDF", variant: "destructive" });
    }
  };

  const exposureColor = (score: number) => {
    if (score >= 8) return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
    if (score >= 5) return "bg-severity-high/15 text-severity-high border-severity-high/30";
    if (score >= 2) return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
    return "bg-severity-low/15 text-severity-low border-severity-low/30";
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Software Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">Microsoft Defender — Vulnerability Management</p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToHTML} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Export as HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToTXT} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Export as TXT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={fetchSoftwareInventory} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {software.length > 0 ? "Refresh" : "Fetch Inventory"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        {software.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div 
              onClick={() => setStatFilter(statFilter === "all" ? "all" : "all")}
              className={`border rounded-md bg-card p-4 cursor-pointer transition-all hover:shadow-md ${
                statFilter === "all" ? "ring-2 ring-primary" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Software</span>
              </div>
              <span className="text-2xl font-bold font-mono text-primary">{software.length}</span>
            </div>
            <div 
              onClick={() => setStatFilter(statFilter === "vulnerable" ? "all" : "vulnerable")}
              className={`border rounded-md bg-card p-4 cursor-pointer transition-all hover:shadow-md ${
                statFilter === "vulnerable" ? "ring-2 ring-severity-critical" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-severity-critical" />
                <span className="text-xs text-muted-foreground">Vulnerable</span>
              </div>
              <span className="text-2xl font-bold font-mono text-severity-critical">
                {software.filter(s => s.exposedVulnerabilities > 0).length}
              </span>
            </div>
            <div 
              onClick={() => setStatFilter(statFilter === "exploits" ? "all" : "exploits")}
              className={`border rounded-md bg-card p-4 cursor-pointer transition-all hover:shadow-md ${
                statFilter === "exploits" ? "ring-2 ring-severity-high" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-severity-high" />
                <span className="text-xs text-muted-foreground">Public Exploits</span>
              </div>
              <span className="text-2xl font-bold font-mono text-severity-high">
                {software.filter(s => s.publicExploit).length}
              </span>
            </div>
            <div 
              onClick={() => setStatFilter(statFilter === "high-exposure" ? "all" : "high-exposure")}
              className={`border rounded-md bg-card p-4 cursor-pointer transition-all hover:shadow-md ${
                statFilter === "high-exposure" ? "ring-2 ring-severity-medium" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Monitor className="h-4 w-4 text-severity-medium" />
                <span className="text-xs text-muted-foreground">High Exposure</span>
              </div>
              <span className="text-2xl font-bold font-mono text-severity-medium">
                {software.filter(s => s.exposureScore >= 5).length}
              </span>
            </div>
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
            <p className="text-sm">Click "Fetch Inventory" to load software data from Microsoft Defender</p>
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
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSoftware.map(sw => (
                  <tr
                    key={sw.id}
                    onClick={() => handleSelectSoftware(sw)}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{sw.name}</p>
                      <p className="text-xs text-muted-foreground">{sw.vendor}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{sw.version}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{sw.installedMachines}</td>
                    <td className="px-4 py-3 text-center">
                      {sw.exposedVulnerabilities > 0 ? (
                        <Badge variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">
                          {sw.exposedVulnerabilities}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={`text-[10px] font-mono ${exposureColor(sw.exposureScore)}`}>
                        {sw.exposureScore.toFixed(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Machine Details Dialog */}
        <Dialog open={!!selectedSoftware} onOpenChange={(open) => { if (!open) setSelectedSoftware(null); }}>
          <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                {selectedSoftware?.name} — Installed Machines
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {machineLoading ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-muted-foreground text-sm">Loading machine details...</span>
                </div>
              ) : machineDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No machine data available. Ensure the Defender API key is configured.</p>
              ) : (
                <div className="space-y-3">
                  {machineDetails.map((m, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground flex items-center gap-1.5">
                            <Monitor className="h-3.5 w-3.5 text-primary" /> {m.deviceName}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.osVersion}</p>
                        </div>
                        <Badge variant="outline" className={exposureColor(
                          m.exposureLevel === "High" ? 8 : m.exposureLevel === "Medium" ? 5 : 1
                        )}>
                          {m.exposureLevel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {m.lastLoggedOnUser || "Unknown"}</span>
                        <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {m.deviceGroup}</span>
                      </div>
                      {m.cves && m.cves.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {m.cves.map(cve => (
                            <Badge key={cve} variant="outline" className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20">
                              {cve}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
