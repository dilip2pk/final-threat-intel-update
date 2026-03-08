import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, Bell, Clock, Shield, Mail, Ticket, Brain, Eye, EyeOff, Zap, Loader2,
  CheckCircle2, XCircle, Key, Globe, Settings2, ArrowRightLeft, Upload, Image as ImageIcon, Trash2, Lock, FileText, Palette, Server,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskSecret } from "@/lib/settingsStore";
import { testAIConnection, testServiceNowConnection } from "@/lib/api";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings, setSettings, general, setGeneral, loading, saving, saveAll } = useSettings();
  const { isAdmin, role, loading: authLoading } = useAuth();

  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showSnowPass, setShowSnowPass] = useState(false);
  const [showAIKey, setShowAIKey] = useState(false);
  const [showSnowKey, setShowSnowKey] = useState(false);
  const [showShodanKey, setShowShodanKey] = useState(false);
  const [showDefenderSecret, setShowDefenderSecret] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingSN, setTestingSN] = useState(false);
  const [snTestResult, setSnTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingShodan, setTestingShodan] = useState(false);
  const [shodanTestResult, setShodanTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingDefender, setTestingDefender] = useState(false);
  const [defenderTestResult, setDefenderTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Report customization state
  const [reportConfig, setReportConfig] = useState({
    orgName: "ThreatIntel",
    logoUrl: "",
    reportTitle: "Security Scan Report",
    headerText: "",
    footerText: "Confidential — for authorized personnel only.",
    primaryColor: "#14b8a6",
    dateFormat: "MMM d, yyyy HH:mm",
    includeSections: {
      summary: true,
      hostDetails: true,
      aiAnalysis: true,
      remediation: true,
      firewallRules: true,
      patchRecommendations: true,
    },
  });
  const [savingReport, setSavingReport] = useState(false);

  // Load report customization from DB
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "report_customization").single().then(({ data }) => {
      if (data?.value) setReportConfig(prev => ({ ...prev, ...(data.value as any), includeSections: { ...prev.includeSections, ...(data.value as any)?.includeSections } }));
    });
  }, []);

  const saveReportConfig = async () => {
    setSavingReport(true);
    try {
      await supabase.from("app_settings").upsert({ key: "report_customization", value: reportConfig as any }, { onConflict: "key" });
      toast({ title: "Report Settings Saved" });
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingReport(false);
    }
  };

  // Integration-specific settings stored in the integrations key
  const shodanApiKey = settings.shodan?.apiKey || "";
  const shodanEnabled = settings.shodan?.enabled ?? false;
  const defenderTenantId = settings.defender?.tenantId || "";
  const defenderClientId = settings.defender?.clientId || "";
  const defenderClientSecret = settings.defender?.clientSecret || "";
  const defenderEnabled = settings.defender?.enabled ?? false;
  const nmapMode = settings.nmapBackend?.mode || "cloud";
  const nmapLocalUrl = settings.nmapBackend?.localUrl || "http://localhost:3001";
  const nmapApiKey = settings.nmapBackend?.apiKey || "";

  const [showNmapKey, setShowNmapKey] = useState(false);
  const [testingNmap, setTestingNmap] = useState(false);
  const [nmapTestResult, setNmapTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const updateShodan = (field: string, value: any) => {
    setSettings((s: any) => ({ ...s, shodan: { ...s.shodan, [field]: value } }));
  };
  const updateDefender = (field: string, value: any) => {
    setSettings((s: any) => ({ ...s, defender: { ...s.defender, [field]: value } }));
  };
  const updateNmapBackend = (field: string, value: any) => {
    setSettings((s: any) => ({ ...s, nmapBackend: { ...s.nmapBackend, [field]: value } }));
  };

  const handleTestNmap = async () => {
    if (nmapMode !== "local") {
      setNmapTestResult({ success: true, message: "Cloud backend is active — no local server needed." });
      return;
    }
    setTestingNmap(true);
    setNmapTestResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
      if (nmapApiKey) headers["x-api-key"] = nmapApiKey;
      const resp = await fetch(`${nmapLocalUrl.replace(/\/$/, "")}/api/health`, { headers });
      const data = await resp.json();
      if (data.status === "ok" && data.nmap) {
        setNmapTestResult({ success: true, message: `Connected! ${data.version}` });
      } else {
        setNmapTestResult({ success: false, message: data.message || "Server reachable but Nmap not found" });
      }
    } catch (e: any) {
      setNmapTestResult({ success: false, message: `Cannot reach server: ${e.message}` });
    } finally {
      setTestingNmap(false);
    }
  };

  const updateSmtp = (field: string, value: string) => {
    setSettings((s) => ({ ...s, smtp: { ...s.smtp, [field]: value } }));
  };
  const updateServiceNow = (field: string, value: string) => {
    setSettings((s) => ({ ...s, serviceNow: { ...s.serviceNow, [field]: value } }));
  };
  const updateFieldMapping = (field: string, value: string) => {
    setSettings((s) => ({
      ...s,
      serviceNow: {
        ...s.serviceNow,
        fieldMapping: { ...s.serviceNow.fieldMapping, [field]: value },
      },
    }));
  };
  const updateAI = (field: string, value: string) => {
    setSettings((s) => ({ ...s, ai: { ...s.ai, [field]: value } }));
  };

  const handleSave = async () => {
    const success = await saveAll(settings, general);
    toast({
      title: success ? "Settings Saved" : "Save Failed",
      description: success ? "All configurations have been persisted to the database" : "Could not save settings. Please try again.",
      variant: success ? "default" : "destructive",
    });
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const result = await testAIConnection({
        model: settings.ai.model,
        endpointUrl: settings.ai.endpointUrl,
        apiKey: settings.ai.apiKey,
        timeout: settings.ai.timeout,
        apiType: settings.ai.apiType,
        authHeaderType: settings.ai.authHeaderType,
      });
      setAiTestResult(result);
    } catch (e: any) {
      setAiTestResult({ success: false, message: e.message });
    } finally {
      setTestingAI(false);
    }
  };

  const handleTestSN = async () => {
    setTestingSN(true);
    setSnTestResult(null);
    try {
      const result = await testServiceNowConnection({ instanceUrl: settings.serviceNow.instanceUrl, username: settings.serviceNow.username, password: settings.serviceNow.password, apiKey: settings.serviceNow.apiKey, authMethod: settings.serviceNow.authMethod });
      setSnTestResult(result);
    } catch (e: any) {
      setSnTestResult({ success: false, message: e.message });
    } finally {
      setTestingSN(false);
    }
  };

  const handleTestShodan = async () => {
    if (!shodanApiKey) {
      setShodanTestResult({ success: false, message: "API key is required" });
      return;
    }
    setTestingShodan(true);
    setShodanTestResult(null);
    try {
      await saveAll(settings, general);
      const { data, error } = await supabase.functions.invoke("shodan-proxy", {
        body: { query: "test", type: "info", apiKey: shodanApiKey },
      });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data?.error || "Connection failed");
      setShodanTestResult({ success: true, message: "Shodan API connected & settings saved" });
    } catch (e: any) {
      setShodanTestResult({ success: false, message: e.message });
    } finally {
      setTestingShodan(false);
    }
  };

  const handleTestDefender = async () => {
    if (!defenderTenantId || !defenderClientId || !defenderClientSecret) {
      setDefenderTestResult({ success: false, message: "All fields are required" });
      return;
    }
    setTestingDefender(true);
    setDefenderTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("defender-proxy", {
        body: { action: "test", tenantId: defenderTenantId, clientId: defenderClientId, clientSecret: defenderClientSecret },
      });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data?.error || "Connection failed");
      setDefenderTestResult({ success: true, message: "Microsoft Defender connection successful" });
    } catch (e: any) {
      setDefenderTestResult({ success: false, message: e.message });
    } finally {
      setTestingDefender(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo.${ext}`;
      await supabase.storage.from("org-assets").remove(["logo.png", "logo.jpg", "logo.jpeg", "logo.svg", "logo.webp"]);
      const { error } = await supabase.storage.from("org-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("org-assets").getPublicUrl(path);
      setGeneral(prev => ({ ...prev, logoUrl: urlData.publicUrl }));
      toast({ title: "Logo Uploaded", description: "Organization logo has been updated" });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setGeneral(prev => ({ ...prev, logoUrl: "" }));
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `sidebar-icon.${ext}`;
      await supabase.storage.from("org-assets").remove(["sidebar-icon.png", "sidebar-icon.jpg", "sidebar-icon.jpeg", "sidebar-icon.svg", "sidebar-icon.webp"]);
      const { error } = await supabase.storage.from("org-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("org-assets").getPublicUrl(path);
      setGeneral(prev => ({ ...prev, sidebarIconUrl: urlData.publicUrl }));
      toast({ title: "Icon Uploaded", description: "Sidebar icon has been updated" });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingIcon(false);
    }
  };

  const removeIcon = () => {
    setGeneral(prev => ({ ...prev, sidebarIconUrl: "" }));
  };

  const aiModels = [
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Fast)" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Balanced)" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Best Quality)" },
    { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro (Next-Gen)" },
    { value: "openai/gpt-5-mini", label: "GPT-5 Mini (Fast)" },
    { value: "openai/gpt-5", label: "GPT-5 (High Quality)" },
    { value: "openai/gpt-5.2", label: "GPT-5.2 (Latest)" },
  ];

  const TestResultBadge = ({ result }: { result: { success: boolean; message: string } | null }) => {
    if (!result) return null;
    return (
      <div className={`flex items-center gap-2 p-3 rounded-md border text-xs ${
        result.success ? "bg-severity-low/10 border-severity-low/30 text-severity-low" : "bg-destructive/10 border-destructive/30 text-destructive"
      }`}>
        {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
        <span>{result.message}</span>
      </div>
    );
  };

  if (loading || authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading settings...</span>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Settings are restricted to Admin users. Your current role: <Badge variant="secondary">{role || "user"}</Badge>
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure platform behavior and integrations — all changes persist to the database</p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="bg-muted/30 border border-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="ai">AI Integration</TabsTrigger>
            <TabsTrigger value="nmap">Network Scanner</TabsTrigger>
            <TabsTrigger value="email">Email (SMTP)</TabsTrigger>
            <TabsTrigger value="servicenow">ServiceDesk</TabsTrigger>
            <TabsTrigger value="shodan">Shodan</TabsTrigger>
            <TabsTrigger value="defender">Defender</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="template">Alert Template</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Fetch Configuration
              </h2>
              <div>
                <Label>RSS Fetch Interval (cron expression)</Label>
                <Input value={general.fetchInterval} onChange={e => setGeneral(g => ({ ...g, fetchInterval: e.target.value }))} className="mt-1 font-mono" placeholder="*/30 * * * *" />
                <p className="text-xs text-muted-foreground mt-1">Default: every 30 minutes</p>
              </div>
              <div>
                <Label>Severity Threshold for Alerts</Label>
                <Select value={general.severityThreshold} onValueChange={v => setGeneral(g => ({ ...g, severityThreshold: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["critical", "high", "medium", "low", "info"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Duplicate Detection</Label>
                  <p className="text-xs text-muted-foreground">Prevent ingesting duplicate feed items</p>
                </div>
                <Switch checked={general.duplicateDetection} onCheckedChange={v => setGeneral(g => ({ ...g, duplicateDetection: v }))} />
              </div>
            </div>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> Application Name
              </h2>
              <p className="text-xs text-muted-foreground">Set the name displayed across the application — sidebar, page title, and reports.</p>
              <div>
                <Label>App Name</Label>
                <Input value={general.appName} onChange={e => setGeneral(g => ({ ...g, appName: e.target.value }))} className="mt-1" placeholder="ThreatIntel" />
              </div>
            </div>
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Organization Logo
              </h2>
              <p className="text-xs text-muted-foreground">Upload your organization's logo. It will appear in the sidebar and reports.</p>
              <div className="flex items-center gap-6">
                {general.logoUrl ? (
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden">
                      <img src={general.logoUrl} alt="Organization logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <button onClick={removeLogo} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border bg-muted/20 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, SVG or WEBP. Max 2MB.</p>
                </div>
              </div>
            </div>
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Sidebar Icon
              </h2>
              <p className="text-xs text-muted-foreground">Upload a custom icon for the sidebar header. Replaces the default shield icon. Recommended: 28×28px square image.</p>
              <div className="flex items-center gap-6">
                {general.sidebarIconUrl ? (
                  <div className="relative group">
                    <div className="w-16 h-16 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden">
                      <img src={general.sidebarIconUrl} alt="Sidebar icon" className="max-w-full max-h-full object-contain" />
                    </div>
                    <button onClick={removeIcon} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border bg-muted/20 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="space-y-2">
                  <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon}>
                    {uploadingIcon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploadingIcon ? "Uploading..." : "Upload Icon"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, SVG or WEBP. Square format recommended.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* AI Integration Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> AI Model Configuration
              </h2>
              <div>
                <Label>AI Provider</Label>
                <Select value={settings.ai.apiType || "builtin"} onValueChange={(v) => {
                  if (v === "builtin") {
                    updateAI("endpointUrl", "");
                    updateAI("apiKey", "");
                    updateAI("model", "google/gemini-3-flash-preview");
                    updateAI("apiType", "builtin");
                    updateAI("authHeaderType", "bearer");
                  } else if (v === "intelligence-studio") {
                    updateAI("apiType", "intelligence-studio");
                    updateAI("authHeaderType", "x-api-key");
                    updateAI("endpointUrl", " ");
                  } else {
                    updateAI("apiType", "openai-compatible");
                    updateAI("authHeaderType", "bearer");
                    updateAI("endpointUrl", " ");
                  }
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builtin">Built-in AI (Lovable Gateway)</SelectItem>
                    <SelectItem value="openai-compatible">Custom / Self-Hosted (OpenAI-compatible)</SelectItem>
                    <SelectItem value="intelligence-studio">Intelligence Studio (Aptean)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.ai.apiType === "intelligence-studio" ? "Using Aptean Intelligence Studio API" : settings.ai.apiType === "openai-compatible" ? "Using custom OpenAI-compatible endpoint — configure below" : "Using built-in AI service, no API key needed"}
                </p>
              </div>
              <div>
                <Label>AI Model</Label>
                {settings.ai.apiType !== "builtin" ? (
                  <>
                    <Input value={settings.ai.model} onChange={(e) => updateAI("model", e.target.value)} className="mt-1 font-mono" placeholder={settings.ai.apiType === "intelligence-studio" ? "Flow ID or model name" : "gpt-4o, llama3, mistral, etc."} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.ai.apiType === "intelligence-studio" ? "The flow/model identifier used by Intelligence Studio" : "Type any model name supported by your endpoint"}
                    </p>
                  </>
                ) : (
                  <Select value={settings.ai.model} onValueChange={(v) => updateAI("model", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {aiModels.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Max Tokens</Label>
                  <Input value={settings.ai.maxTokens} onChange={(e) => updateAI("maxTokens", e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label>Temperature</Label>
                  <Input value={settings.ai.temperature} onChange={(e) => updateAI("temperature", e.target.value)} className="mt-1 font-mono" />
                </div>
              </div>
              <div>
                <Label>Timeout (seconds)</Label>
                <Input value={settings.ai.timeout} onChange={(e) => updateAI("timeout", e.target.value)} className="mt-1 font-mono" />
              </div>
            </div>

            {/* Custom Endpoint Config — shown when non-builtin provider selected */}
            {settings.ai.apiType !== "builtin" && (
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                {settings.ai.apiType === "intelligence-studio" ? "Intelligence Studio Configuration" : "Custom Endpoint Configuration"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {settings.ai.apiType === "intelligence-studio"
                  ? "Configure your Aptean Intelligence Studio endpoint. Uses x-api-key authentication."
                  : "Configure your self-hosted or third-party OpenAI-compatible endpoint."}
              </p>
              <div>
                <Label>Endpoint URL</Label>
                <Input value={settings.ai.endpointUrl?.trim() || ""} onChange={(e) => updateAI("endpointUrl", e.target.value)} className="mt-1 font-mono" placeholder={settings.ai.apiType === "intelligence-studio" ? "https://appcentral-int.aptean.com/ais/api/v1/run/<flow-id>" : "http://localhost:11434/v1/chat/completions"} />
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.ai.apiType === "intelligence-studio"
                    ? "Full Intelligence Studio API URL including the flow/run ID"
                    : "Supports OpenAI-compatible APIs: Ollama, LM Studio, vLLM, LocalAI, Azure OpenAI, etc."}
                </p>
              </div>
              <div>
                <Label>Authentication Header</Label>
                <Select value={settings.ai.authHeaderType || "bearer"} onValueChange={(v) => updateAI("authHeaderType", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bearer">Authorization: Bearer (standard)</SelectItem>
                    <SelectItem value="x-api-key">x-api-key (Intelligence Studio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>API Key <span className="text-muted-foreground font-normal">(optional for local endpoints)</span></Label>
                <div className="relative mt-1">
                  <Input type={showAIKey ? "text" : "password"} value={settings.ai.apiKey} onChange={(e) => updateAI("apiKey", e.target.value)} placeholder={settings.ai.apiType === "intelligence-studio" ? "sk-..." : "sk-... or leave blank for local"} className="font-mono" />
                  <button type="button" onClick={() => setShowAIKey(!showAIKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {settings.ai.apiKey && !showAIKey && <p className="text-xs text-muted-foreground mt-1 font-mono">{maskSecret(settings.ai.apiKey)}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleTestAI} disabled={testingAI} className="gap-2">
                  {testingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
                </Button>
              </div>
              <TestResultBadge result={aiTestResult} />
            </div>
            )}
          </TabsContent>

          {/* Email (SMTP) Tab */}
          <TabsContent value="email" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> SMTP Configuration
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>SMTP Host</Label>
                  <Input value={settings.smtp.host} onChange={(e) => updateSmtp("host", e.target.value)} className="mt-1 font-mono" placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input value={settings.smtp.port} onChange={(e) => updateSmtp("port", e.target.value)} className="mt-1 font-mono" placeholder="587" />
                </div>
              </div>
              <div>
                <Label>Username</Label>
                <Input value={settings.smtp.username} onChange={(e) => updateSmtp("username", e.target.value)} className="mt-1" placeholder="your-email@example.com" />
              </div>
              <div>
                <Label>Password</Label>
                <div className="relative mt-1">
                  <Input type={showSmtpPass ? "text" : "password"} value={settings.smtp.password} onChange={(e) => updateSmtp("password", e.target.value)} placeholder="App password" />
                  <button type="button" onClick={() => setShowSmtpPass(!showSmtpPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>From Address</Label>
                <Input value={settings.smtp.from} onChange={(e) => updateSmtp("from", e.target.value)} className="mt-1" placeholder="threatintel@yourcompany.com" />
              </div>
            </div>
          </TabsContent>

          {/* ServiceDesk Tab */}
          <TabsContent value="servicenow" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" /> ServiceNow Connection
              </h2>
              <div>
                <Label>Instance URL</Label>
                <Input value={settings.serviceNow.instanceUrl} onChange={(e) => updateServiceNow("instanceUrl", e.target.value)} className="mt-1 font-mono" placeholder="https://yourinstance.service-now.com" />
              </div>
              <div>
                <Label>Authentication Method</Label>
                <Select value={settings.serviceNow.authMethod} onValueChange={(v) => updateServiceNow("authMethod", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic Auth (Username/Password)</SelectItem>
                    <SelectItem value="bearer">Bearer Token (API Key)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.serviceNow.authMethod === "basic" && (
                <>
                  <div>
                    <Label>Username</Label>
                    <Input value={settings.serviceNow.username} onChange={(e) => updateServiceNow("username", e.target.value)} className="mt-1" placeholder="admin" />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <div className="relative mt-1">
                      <Input type={showSnowPass ? "text" : "password"} value={settings.serviceNow.password} onChange={(e) => updateServiceNow("password", e.target.value)} placeholder="ServiceNow password" />
                      <button type="button" onClick={() => setShowSnowPass(!showSnowPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showSnowPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {settings.serviceNow.authMethod === "bearer" && (
                <div>
                  <Label>API Key / Bearer Token</Label>
                  <div className="relative mt-1">
                    <Input type={showSnowKey ? "text" : "password"} value={settings.serviceNow.apiKey} onChange={(e) => updateServiceNow("apiKey", e.target.value)} placeholder="Bearer token" className="font-mono" />
                    <button type="button" onClick={() => setShowSnowKey(!showSnowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSnowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {settings.serviceNow.apiKey && !showSnowKey && <p className="text-xs text-muted-foreground mt-1 font-mono">{maskSecret(settings.serviceNow.apiKey)}</p>}
                </div>
              )}
              <div>
                <Label>Table Name</Label>
                <Input value={settings.serviceNow.tableName} onChange={(e) => updateServiceNow("tableName", e.target.value)} className="mt-1 font-mono" placeholder="incident" />
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleTestSN} disabled={testingSN} className="gap-2">
                  {testingSN ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
                </Button>
              </div>
              <TestResultBadge result={snTestResult} />
            </div>
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" /> Field Mapping
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {(["title", "description", "priority", "category"] as const).map(field => (
                  <div key={field}>
                    <Label className="capitalize">{field} → Field</Label>
                    <Input value={settings.serviceNow.fieldMapping[field]} onChange={(e) => updateFieldMapping(field, e.target.value)} className="mt-1 font-mono" />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Shodan Tab */}
          <TabsContent value="shodan" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> Shodan API Configuration
                </h2>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Enabled</Label>
                  <Switch checked={shodanEnabled} onCheckedChange={v => updateShodan("enabled", v)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API key from <a href="https://account.shodan.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">account.shodan.io</a>.
              </p>
              <div>
                <Label>API Key</Label>
                <div className="relative mt-1">
                  <Input
                    type={showShodanKey ? "text" : "password"}
                    value={shodanApiKey}
                    onChange={(e) => updateShodan("apiKey", e.target.value)}
                    placeholder="Enter your Shodan API key"
                    className="font-mono"
                  />
                  <button type="button" onClick={() => setShowShodanKey(!showShodanKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showShodanKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {shodanApiKey && !showShodanKey && <p className="text-xs text-muted-foreground mt-1 font-mono">{maskSecret(shodanApiKey)}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleTestShodan} disabled={testingShodan || !shodanApiKey} className="gap-2">
                  {testingShodan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
                </Button>
              </div>
              <TestResultBadge result={shodanTestResult} />
            </div>
          </TabsContent>

          {/* Defender Tab */}
          <TabsContent value="defender" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Microsoft Defender Configuration
                </h2>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Enabled</Label>
                  <Switch checked={defenderEnabled} onCheckedChange={v => updateDefender("enabled", v)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires Azure AD App Registration with Microsoft Defender for Endpoint permissions.
              </p>
              <div>
                <Label>Tenant ID</Label>
                <Input value={defenderTenantId} onChange={(e) => updateDefender("tenantId", e.target.value)} className="mt-1 font-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <div>
                <Label>Client ID (Application ID)</Label>
                <Input value={defenderClientId} onChange={(e) => updateDefender("clientId", e.target.value)} className="mt-1 font-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <div>
                <Label>Client Secret</Label>
                <div className="relative mt-1">
                  <Input
                    type={showDefenderSecret ? "text" : "password"}
                    value={defenderClientSecret}
                    onChange={(e) => updateDefender("clientSecret", e.target.value)}
                    placeholder="Client secret value"
                    className="font-mono"
                  />
                  <button type="button" onClick={() => setShowDefenderSecret(!showDefenderSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showDefenderSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {defenderClientSecret && !showDefenderSecret && <p className="text-xs text-muted-foreground mt-1 font-mono">{maskSecret(defenderClientSecret)}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleTestDefender} disabled={testingDefender || !defenderTenantId || !defenderClientId || !defenderClientSecret} className="gap-2">
                  {testingDefender ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
                </Button>
              </div>
              <TestResultBadge result={defenderTestResult} />
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Notification Provider
              </h2>
              <div>
                <Label>Provider</Label>
                <Select value={general.notifyProvider} onValueChange={v => setGeneral(g => ({ ...g, notifyProvider: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["slack", "email", "webhook", "telegram", "discord"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Webhook / API URL</Label>
                <Input value={general.webhookUrl} onChange={e => setGeneral(g => ({ ...g, webhookUrl: e.target.value }))} className="mt-1 font-mono" placeholder="https://hooks.slack.com/services/..." />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Send alerts to configured email</p>
                </div>
                <Switch checked={general.emailEnabled} onCheckedChange={v => setGeneral(g => ({ ...g, emailEnabled: v }))} />
              </div>
            </div>

            {/* RansomLook Watchlist Notifications */}
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Eye className="h-4 w-4 text-severity-high" /> RansomLook Watchlist Notifications
              </h2>
              <p className="text-xs text-muted-foreground">
                When organizations on the watchlist are detected in new ransomware leak posts, send notifications via the configured method.
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Watchlist Alerts</Label>
                  <p className="text-xs text-muted-foreground">Automatically check new leaks against your watchlist</p>
                </div>
                <Switch
                  checked={watchlistNotify.enabled}
                  onCheckedChange={v => setWatchlistNotify(c => ({ ...c, enabled: v }))}
                />
              </div>
              <div>
                <Label>Notification Recipients (email)</Label>
                <Input
                  value={watchlistNotify.recipients}
                  onChange={e => setWatchlistNotify(c => ({ ...c, recipients: e.target.value }))}
                  className="mt-1 font-mono text-sm"
                  placeholder="user@company.com, soc@company.com"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated list of email addresses</p>
              </div>
              <div>
                <Label>Check Frequency</Label>
                <Select value={watchlistNotify.frequency} onValueChange={v => setWatchlistNotify(c => ({ ...c, frequency: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time (every new check)</SelectItem>
                    <SelectItem value="hourly">Hourly Digest</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notification Method</Label>
                <Select value={watchlistNotify.method} onValueChange={v => setWatchlistNotify(c => ({ ...c, method: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email (via SMTP)</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveWatchlistNotify} disabled={savingWatchlistNotify} className="gap-2">
                {savingWatchlistNotify ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingWatchlistNotify ? "Saving..." : "Save Watchlist Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestWatchlistCheck}
                disabled={testingWatchlist}
                className="gap-2 ml-2"
              >
                {testingWatchlist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Test Watchlist Check Now
              </Button>
              {watchlistTestResult && (
                <div className={`mt-2 flex items-center gap-2 text-xs ${watchlistTestResult.success ? "text-severity-low" : "text-severity-high"}`}>
                  {watchlistTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {watchlistTestResult.message}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Alert Template Tab */}
          <TabsContent value="template" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Alert Template
              </h2>
              <div>
                <Label>Template (supports variables)</Label>
                <Textarea value={general.alertTemplate} onChange={e => setGeneral(g => ({ ...g, alertTemplate: e.target.value }))} className="mt-1 font-mono text-xs min-h-[150px]" />
                <p className="text-xs text-muted-foreground mt-1">
                  Variables: {"{{title}}"}, {"{{severity}}"}, {"{{source}}"}, {"{{date}}"}, {"{{description}}"}, {"{{link}}"}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Network Scanner Backend Tab */}
          <TabsContent value="nmap" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" /> Scan Backend
              </h2>
              <p className="text-xs text-muted-foreground">
                Choose between the cloud-based TCP scanner or a local Nmap server for real network scanning with OS detection, service fingerprinting, and NSE scripts.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateNmapBackend("mode", "cloud")}
                  className={`border rounded-lg p-4 text-left transition-colors ${nmapMode === "cloud" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <p className="text-sm font-semibold text-foreground">☁️ Cloud Backend</p>
                  <p className="text-xs text-muted-foreground mt-1">Simulated TCP-connect scanning via backend functions. No local setup required.</p>
                </button>
                <button
                  onClick={() => updateNmapBackend("mode", "local")}
                  className={`border rounded-lg p-4 text-left transition-colors ${nmapMode === "local" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <p className="text-sm font-semibold text-foreground">🖥️ Local Nmap Server</p>
                  <p className="text-xs text-muted-foreground mt-1">Real Nmap execution with OS detection, version scanning, and NSE vulnerability scripts.</p>
                </button>
              </div>

              {nmapMode === "local" && (
                <div className="space-y-4 border-t border-border pt-4">
                  <div>
                    <Label>Server URL</Label>
                    <Input
                      value={nmapLocalUrl}
                      onChange={e => updateNmapBackend("localUrl", e.target.value)}
                      className="mt-1 font-mono"
                      placeholder="http://localhost:3001"
                    />
                    <p className="text-xs text-muted-foreground mt-1">URL of your local Nmap backend server</p>
                  </div>
                  <div>
                    <Label>API Key (optional)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type={showNmapKey ? "text" : "password"}
                        value={nmapApiKey}
                        onChange={e => updateNmapBackend("apiKey", e.target.value)}
                        className="font-mono"
                        placeholder="Leave empty if not configured"
                      />
                      <Button variant="ghost" size="icon" onClick={() => setShowNmapKey(!showNmapKey)}>
                        {showNmapKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="border border-dashed border-border rounded-lg p-4 bg-muted/20">
                    <h3 className="text-xs font-semibold text-foreground mb-2">📋 Setup Instructions</h3>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Install Node.js 18+ and Nmap on your machine</li>
                      <li>Navigate to <code className="bg-muted px-1 rounded">local-nmap-server/</code> in the project</li>
                      <li>Run <code className="bg-muted px-1 rounded">npm install</code></li>
                      <li>Start with <code className="bg-muted px-1 rounded">sudo node server.js</code> (root needed for OS detection)</li>
                      <li>Optionally set <code className="bg-muted px-1 rounded">NMAP_API_KEY=your-key</code> environment variable</li>
                    </ol>
                  </div>

                  <Button onClick={handleTestNmap} disabled={testingNmap} variant="outline" className="gap-2">
                    {testingNmap ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Test Connection
                  </Button>
                  {nmapTestResult && <TestResultBadge result={nmapTestResult} />}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Report Customization Tab */}
          <TabsContent value="reports" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Report Branding
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Organization Name</Label>
                  <Input value={reportConfig.orgName} onChange={e => setReportConfig(c => ({ ...c, orgName: e.target.value }))} className="mt-1" placeholder="Your Organization" />
                </div>
                <div>
                  <Label>Report Title</Label>
                  <Input value={reportConfig.reportTitle} onChange={e => setReportConfig(c => ({ ...c, reportTitle: e.target.value }))} className="mt-1" placeholder="Security Scan Report" />
                </div>
              </div>
              <div>
                <Label>Header Text (optional)</Label>
                <Input value={reportConfig.headerText} onChange={e => setReportConfig(c => ({ ...c, headerText: e.target.value }))} className="mt-1" placeholder="Internal Use Only" />
              </div>
              <div>
                <Label>Footer / Disclaimer</Label>
                <Textarea value={reportConfig.footerText} onChange={e => setReportConfig(c => ({ ...c, footerText: e.target.value }))} className="mt-1 text-sm" rows={2} />
              </div>
              <div>
                <Label>Logo URL</Label>
                <Input value={reportConfig.logoUrl} onChange={e => setReportConfig(c => ({ ...c, logoUrl: e.target.value }))} className="mt-1 font-mono text-sm" placeholder="https://... (or use the one from Branding tab)" />
                <p className="text-xs text-muted-foreground mt-1">Leave empty to use the organization logo from the Branding tab.</p>
              </div>
            </div>

            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> Appearance
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={reportConfig.primaryColor} onChange={e => setReportConfig(c => ({ ...c, primaryColor: e.target.value }))} className="w-10 h-10 rounded border border-border cursor-pointer" />
                    <Input value={reportConfig.primaryColor} onChange={e => setReportConfig(c => ({ ...c, primaryColor: e.target.value }))} className="font-mono" />
                  </div>
                </div>
                <div>
                  <Label>Date/Time Format</Label>
                  <Select value={reportConfig.dateFormat} onValueChange={v => setReportConfig(c => ({ ...c, dateFormat: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MMM d, yyyy HH:mm">MMM d, yyyy HH:mm</SelectItem>
                      <SelectItem value="yyyy-MM-dd HH:mm:ss">yyyy-MM-dd HH:mm:ss</SelectItem>
                      <SelectItem value="dd/MM/yyyy HH:mm">dd/MM/yyyy HH:mm</SelectItem>
                      <SelectItem value="MM/dd/yyyy hh:mm a">MM/dd/yyyy hh:mm a</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> Sections to Include
              </h2>
              <p className="text-xs text-muted-foreground">Choose which sections appear in the generated PDF/HTML reports.</p>
              <div className="grid md:grid-cols-2 gap-3">
                {([
                  { key: "summary", label: "Scan Summary" },
                  { key: "hostDetails", label: "Host & Port Details" },
                  { key: "aiAnalysis", label: "AI Security Analysis" },
                  { key: "remediation", label: "Remediation Recommendations" },
                  { key: "firewallRules", label: "Firewall Hardening Rules" },
                  { key: "patchRecommendations", label: "Patch Recommendations" },
                ] as const).map(section => (
                  <div key={section.key} className="flex items-center gap-3">
                    <Checkbox
                      id={`section-${section.key}`}
                      checked={reportConfig.includeSections[section.key]}
                      onCheckedChange={(v) => setReportConfig(c => ({
                        ...c,
                        includeSections: { ...c.includeSections, [section.key]: !!v },
                      }))}
                    />
                    <Label htmlFor={`section-${section.key}`} className="text-sm cursor-pointer">{section.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={saveReportConfig} className="gap-2" disabled={savingReport}>
              {savingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingReport ? "Saving..." : "Save Report Settings"}
            </Button>
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </AppLayout>
  );
}
