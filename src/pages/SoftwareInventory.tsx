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

  const filteredSoftware = software.filter(s => {
    if (search) {
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

  const exposureColor = (score: number) => {
    if (score >= 8) return "bg-severity-critical/15 text-severity-critical border-severity-critical/30";
    if (score >= 5) return "bg-severity-high/15 text-severity-high border-severity-high/30";
    if (score >= 2) return "bg-severity-medium/15 text-severity-medium border-severity-medium/30";
    return "bg-severity-low/15 text-severity-low border-severity-low/30";
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Software Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">Microsoft Defender — Vulnerability Management</p>
          </div>
          <Button onClick={fetchSoftwareInventory} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {software.length > 0 ? "Refresh" : "Fetch Inventory"}
          </Button>
        </div>

        {/* Stats */}
        {software.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-border rounded-md bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Software</span>
              </div>
              <span className="text-2xl font-bold font-mono text-primary">{software.length}</span>
            </div>
            <div className="border border-border rounded-md bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-severity-critical" />
                <span className="text-xs text-muted-foreground">Vulnerable</span>
              </div>
              <span className="text-2xl font-bold font-mono text-severity-critical">
                {software.filter(s => s.exposedVulnerabilities > 0).length}
              </span>
            </div>
            <div className="border border-border rounded-md bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-severity-high" />
                <span className="text-xs text-muted-foreground">Public Exploits</span>
              </div>
              <span className="text-2xl font-bold font-mono text-severity-high">
                {software.filter(s => s.publicExploit).length}
              </span>
            </div>
            <div className="border border-border rounded-md bg-card p-4">
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
