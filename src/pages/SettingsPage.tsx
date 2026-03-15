import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import AIPromptManager from "@/components/settings/AIPromptManager";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Save, Bell, Clock, Shield, Mail, Ticket, Brain, Eye, EyeOff, Zap, Loader2,
  CheckCircle2, XCircle, Key, Globe, Settings2, ArrowRightLeft, Upload, Image as ImageIcon, Trash2, Lock, FileText, Palette, Server,
  ChevronRight, Activity, MessageSquareCode,
} from "lucide-react";
import { HealthCheckPanel } from "@/components/HealthCheckPanel";
import { useToast } from "@/hooks/use-toast";
import { maskSecret } from "@/lib/settingsStore";
import { testAIConnection, testServiceNowConnection } from "@/lib/api";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// --- Reusable components (defined outside to prevent re-creation on re-render) ---
const TestResultBadge = ({ result }: { result: { success: boolean; message: string } | null }) => {
  if (!result) return null;
  return (
    <div className={cn("flex items-center gap-2.5 p-3 rounded-lg border text-xs font-medium", result.success ? "bg-severity-low/10 border-severity-low/20 text-severity-low" : "bg-destructive/10 border-destructive/20 text-destructive")}>
      {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      <span>{result.message}</span>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, description, children, iconColor = "text-primary" }: { title: string; icon: any; description?: string; children: React.ReactNode; iconColor?: string }) => (
  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-border bg-muted/20">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg bg-primary/10", iconColor === "text-severity-high" && "bg-severity-high/10")}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
    </div>
    <div className="p-6 space-y-5">{children}</div>
  </div>
);

const FieldGroup = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
  </div>
);

const PasswordField = ({ value, onChange, show, onToggle, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string }) => (
  <div className="relative">
    <Input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="font-mono pr-10" />
    <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
);

// --- Sidebar nav items ---
const navItems = [
  { id: "general", label: "General", icon: Clock, description: "Fetch & alert configuration" },
  { id: "branding", label: "Branding", icon: Palette, description: "Logo, name & identity" },
  { id: "ai", label: "AI Integration", icon: Brain, description: "Model & provider settings" },
  { id: "ai-prompts", label: "AI Prompts", icon: MessageSquareCode, description: "Manage AI prompt instructions" },
  { id: "advisory-template", label: "Advisory Template", icon: FileText, description: "Customize advisory email layout" },
  { id: "localtools", label: "Local Tools", icon: Server, description: "Local tool server & plugins" },
  { id: "infrastructure", label: "Infrastructure", icon: Activity, description: "Docker services health check" },
  { id: "email", label: "Email (SMTP)", icon: Mail, description: "Outbound email settings" },
  { id: "servicenow", label: "ServiceDesk", icon: Ticket, description: "ServiceNow integration" },
  { id: "shodan", label: "Shodan", icon: Globe, description: "Shodan API configuration" },
  { id: "defender", label: "Defender", icon: Shield, description: "Microsoft Defender" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Alerts & watchlist" },
  { id: "template", label: "Alert Template", icon: Shield, description: "Email template customization" },
  { id: "reports", label: "Reports", icon: FileText, description: "Report branding & sections" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings, setSettings, general, setGeneral, loading, saving, saveAll } = useSettings();
  const { isAdmin, role, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState("general");

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
  const advisoryLogoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAdvisoryLogo, setUploadingAdvisoryLogo] = useState(false);

  const [reportConfig, setReportConfig] = useState({
    orgName: "ThreatIntel",
    logoUrl: "",
    reportTitle: "Security Scan Report",
    headerText: "",
    footerText: "Confidential — for authorized personnel only.",
    primaryColor: "#14b8a6",
    dateFormat: "MMM d, yyyy HH:mm",
    includeSections: {
      summary: true, hostDetails: true, aiAnalysis: true,
      remediation: true, firewallRules: true, patchRecommendations: true,
    },
  });
  const [savingReport, setSavingReport] = useState(false);

  const defaultAdvisoryTemplateDark = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#1a1a2e;">
  <div style="max-width:700px;margin:0 auto;background:#2d2d44;border:1px solid #3d3d5c;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f3460 0%,#16213e 100%);padding:24px 32px;display:flex;align-items:center;justify-content:space-between;">
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{org_name}}</h1>
      {{#logo_url}}<img src="{{logo_url}}" alt="Logo" style="height:40px;" />{{/logo_url}}
    </div>
    <!-- Advisory Bar -->
    <div style="background:#e94560;padding:10px 32px;text-align:center;">
      <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1px;">Advisory: {{title}}</span>
    </div>
    <!-- Severity Badge -->
    <div style="padding:12px 32px 0;"><span style="display:inline-block;padding:4px 14px;border-radius:4px;font-weight:bold;font-size:12px;text-transform:uppercase;color:#fff;background:#e94560;">{{severity}}</span></div>
    <!-- Body -->
    <div style="padding:28px 32px;color:#e0e0e0;font-size:14px;line-height:1.7;">
      <p>Dear All,</p>
      <p>Our security team has recently identified a <strong>{{severity}}</strong> severity issue.</p>

      <h3 style="color:#e94560;margin:20px 0 8px;font-size:15px;">Description:</h3>
      <p>{{summary}}</p>

      <h3 style="color:#e94560;margin:20px 0 8px;font-size:15px;">Impact:</h3>
      <ul style="padding-left:20px;margin:0;">{{impact_html}}</ul>

      <h3 style="color:#e94560;margin:20px 0 8px;font-size:15px;">Affected Versions:</h3>
      {{#has_versions}}<ul style="padding-left:20px;margin:0;">{{versions_html}}</ul>{{/has_versions}}
      {{^has_versions}}<p style="color:#9ca3af;">N/A</p>{{/has_versions}}

      <h3 style="color:#e94560;margin:20px 0 8px;font-size:15px;">Mitigations &amp; Recommendations:</h3>
      <ul style="padding-left:20px;margin:0;">{{mitigations_html}}</ul>

      <h3 style="color:#e94560;margin:20px 0 8px;font-size:15px;">References:</h3>
      <ul style="padding-left:20px;margin:0;">{{references_html}}</ul>

      <p style="margin-top:24px;color:#9ca3af;font-size:13px;">If you have any questions or need clarification regarding this matter, please do not hesitate to reach out to us at <a href="mailto:{{contact_email}}" style="color:#e94560;">{{contact_email}}</a>.</p>
    </div>
    <!-- Footer -->
    <div style="padding:16px 32px;background:#16213e;border-top:1px solid #3d3d5c;">
      <p style="color:#6b7280;font-size:11px;margin:0;">{{footer_text}}</p>
    </div>
  </div>
</body>
</html>`;

  const defaultAdvisoryTemplateLight = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;">
  <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e0e0e0;">
    <!-- Header -->
    <div style="background:#000000;padding:24px 32px;display:flex;align-items:center;justify-content:space-between;">
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">{{org_name}}</h1>
      {{#logo_url}}<img src="{{logo_url}}" alt="Logo" style="height:40px;" />{{/logo_url}}
    </div>
    <!-- Advisory Bar -->
    <div style="background:#333333;padding:10px 32px;text-align:center;">
      <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1px;">Advisory: {{title}}</span>
    </div>
    <!-- Severity Badge -->
    <div style="padding:12px 32px 0;"><span style="display:inline-block;padding:4px 14px;border-radius:4px;font-weight:bold;font-size:12px;text-transform:uppercase;color:#fff;background:#333333;">{{severity}}</span></div>
    <!-- Body -->
    <div style="padding:28px 32px;color:#1a1a1a;font-size:14px;line-height:1.7;">
      <p>Dear All,</p>
      <p>Our security team has recently identified a <strong>{{severity}}</strong> severity issue.</p>

      <h3 style="color:#000000;margin:20px 0 8px;font-size:15px;">Description:</h3>
      <p>{{summary}}</p>

      <h3 style="color:#000000;margin:20px 0 8px;font-size:15px;">Impact:</h3>
      <ul style="padding-left:20px;margin:0;">{{impact_html}}</ul>

      <h3 style="color:#000000;margin:20px 0 8px;font-size:15px;">Affected Versions:</h3>
      {{#has_versions}}<ul style="padding-left:20px;margin:0;">{{versions_html}}</ul>{{/has_versions}}
      {{^has_versions}}<p style="color:#6b7280;">N/A</p>{{/has_versions}}

      <h3 style="color:#000000;margin:20px 0 8px;font-size:15px;">Mitigations &amp; Recommendations:</h3>
      <ul style="padding-left:20px;margin:0;">{{mitigations_html}}</ul>

      <h3 style="color:#000000;margin:20px 0 8px;font-size:15px;">References:</h3>
      <ul style="padding-left:20px;margin:0;">{{references_html}}</ul>

      <p style="margin-top:24px;color:#6b7280;font-size:13px;">If you have any questions or need clarification regarding this matter, please do not hesitate to reach out to us at <a href="mailto:{{contact_email}}" style="color:#000000;font-weight:600;">{{contact_email}}</a>.</p>
    </div>
    <!-- Footer -->
    <div style="padding:16px 32px;background:#f5f5f5;border-top:1px solid #e0e0e0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">{{footer_text}}</p>
    </div>
  </div>
</body>
</html>`;

  const defaultAdvisoryTemplate = defaultAdvisoryTemplateDark;

  const [advisoryTemplate, setAdvisoryTemplate] = useState({
    template: defaultAdvisoryTemplate,
    orgName: "Security & Compliance",
    contactEmail: "security@yourcompany.com",
    footerText: "Generated by ThreatIntel AI Analysis",
    logoUrl: "",
  });
  const [savingAdvisory, setSavingAdvisory] = useState(false);

  const defaultWatchlistTemplate = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 28px 32px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">🚨 RansomLook Watchlist Alert</h1>
    <p style="color: #fecaca; margin: 6px 0 0; font-size: 14px;">{{match_count}} watched organization(s) detected in ransomware leak data</p>
  </div>
  <div style="padding: 28px 32px;">
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">The following organizations from your watchlist were found in recent ransomware group posts:</p>
    {{matches_html}}
    <div style="margin-top: 24px; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
      <p style="color: #991b1b; font-size: 13px; font-weight: 600; margin: 0 0 4px;">⚠️ Recommended Actions</p>
      <ul style="color: #7f1d1d; font-size: 13px; margin: 0; padding-left: 18px; line-height: 1.8;">
        <li>Verify if your organization's data has been compromised</li>
        <li>Notify your incident response team immediately</li>
        <li>Check for any exposed credentials or sensitive data</li>
        <li>Review and update your security posture</li>
      </ul>
    </div>
  </div>
  <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 11px; margin: 0;">This alert was generated by {{app_name}} watchlist monitoring on {{date}}.</p>
  </div>
</div>`;

  const [watchlistNotify, setWatchlistNotify] = useState({
    enabled: false, recipients: "", frequency: "daily", method: "email",
    emailTemplate: defaultWatchlistTemplate,
  });
  const [savingWatchlistNotify, setSavingWatchlistNotify] = useState(false);
  const [testingWatchlist, setTestingWatchlist] = useState(false);
  const [watchlistTestResult, setWatchlistTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "report_customization").single().then(({ data }) => {
      if (data?.value) setReportConfig(prev => ({ ...prev, ...(data.value as any), includeSections: { ...prev.includeSections, ...(data.value as any)?.includeSections } }));
    });
    supabase.from("app_settings").select("value").eq("key", "watchlist_notifications").single().then(({ data }) => {
      if (data?.value) setWatchlistNotify(prev => ({ ...prev, ...(data.value as any) }));
    });
    supabase.from("app_settings").select("value").eq("key", "advisory_template").single().then(({ data }) => {
      if (data?.value) setAdvisoryTemplate(prev => ({ ...prev, ...(data.value as any) }));
    });
  }, []);

  // --- Helpers (same logic, no changes) ---
  const saveReportConfig = async () => {
    setSavingReport(true);
    try {
      await supabase.from("app_settings").upsert({ key: "report_customization", value: reportConfig as any }, { onConflict: "key" });
      toast({ title: "Report Settings Saved" });
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "destructive" }); }
    finally { setSavingReport(false); }
  };

  const saveAdvisoryTemplate = async () => {
    setSavingAdvisory(true);
    try {
      await supabase.from("app_settings").upsert({ key: "advisory_template", value: advisoryTemplate as any }, { onConflict: "key" });
      toast({ title: "Advisory Template Saved" });
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "destructive" }); }
    finally { setSavingAdvisory(false); }
  };

  const handleSaveWatchlistNotify = async () => {
    setSavingWatchlistNotify(true);
    try {
      await supabase.from("app_settings").upsert({ key: "watchlist_notifications", value: watchlistNotify as any }, { onConflict: "key" });
      toast({ title: "Watchlist Notification Settings Saved" });
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "destructive" }); }
    finally { setSavingWatchlistNotify(false); }
  };

  const handleTestWatchlistCheck = async () => {
    setTestingWatchlist(true); setWatchlistTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("watchlist-check", { body: { test: true } });
      if (error) throw new Error(error.message);
      setWatchlistTestResult({ success: data?.success ?? true, message: data?.message || `Found ${data?.matches?.length || 0} matches` });
    } catch (e: any) { setWatchlistTestResult({ success: false, message: e.message }); }
    finally { setTestingWatchlist(false); }
  };

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
  const [discoveredTools, setDiscoveredTools] = useState<Array<{ id: string; name: string; icon: string; version?: string; available: boolean; description: string; category: string }>>([]);

  const updateShodan = (field: string, value: any) => setSettings((s: any) => ({ ...s, shodan: { ...s.shodan, [field]: value } }));
  const updateDefender = (field: string, value: any) => setSettings((s: any) => ({ ...s, defender: { ...s.defender, [field]: value } }));
  const updateNmapBackend = (field: string, value: any) => setSettings((s: any) => ({ ...s, nmapBackend: { ...s.nmapBackend, [field]: value } }));
  const updateSmtp = (field: string, value: string) => setSettings((s) => ({ ...s, smtp: { ...s.smtp, [field]: value } }));
  const updateServiceNow = (field: string, value: string) => setSettings((s) => ({ ...s, serviceNow: { ...s.serviceNow, [field]: value } }));
  const updateFieldMapping = (field: string, value: string) => setSettings((s) => ({ ...s, serviceNow: { ...s.serviceNow, fieldMapping: { ...s.serviceNow.fieldMapping, [field]: value } } }));
  const updateAI = (field: string, value: string) => setSettings((s) => ({ ...s, ai: { ...s.ai, [field]: value } }));

  const handleSave = async () => {
    const success = await saveAll(settings, general);
    // Also persist advisory template, report config, and watchlist notify
    try {
      await Promise.all([
        supabase.from("app_settings").upsert({ key: "advisory_template", value: advisoryTemplate as any }, { onConflict: "key" }),
        supabase.from("app_settings").upsert({ key: "report_customization", value: reportConfig as any }, { onConflict: "key" }),
        supabase.from("app_settings").upsert({ key: "watchlist_notifications", value: watchlistNotify as any }, { onConflict: "key" }),
      ]);
    } catch (e) {
      console.error("Failed to save additional settings:", e);
    }
    toast({ title: success ? "Settings Saved" : "Save Failed", description: success ? "All configurations persisted" : "Could not save. Try again.", variant: success ? "default" : "destructive" });
  };

  const handleUploadAdvisoryLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAdvisoryLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `advisory-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("org-assets").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("org-assets").getPublicUrl(filePath);
      setAdvisoryTemplate(c => ({ ...c, logoUrl: urlData.publicUrl }));
      toast({ title: "Logo Uploaded", description: "Advisory header logo updated." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAdvisoryLogo(false);
      if (advisoryLogoInputRef.current) advisoryLogoInputRef.current.value = "";
    }
  };

  const handleTestAI = async () => {
    setTestingAI(true); setAiTestResult(null);
    try {
      const result = await testAIConnection({ model: settings.ai.model, endpointUrl: settings.ai.endpointUrl, apiKey: settings.ai.apiKey, timeout: settings.ai.timeout, apiType: settings.ai.apiType, authHeaderType: settings.ai.authHeaderType });
      setAiTestResult(result);
    } catch (e: any) { setAiTestResult({ success: false, message: e.message }); }
    finally { setTestingAI(false); }
  };

  const handleTestSN = async () => {
    setTestingSN(true); setSnTestResult(null);
    try {
      const result = await testServiceNowConnection({ instanceUrl: settings.serviceNow.instanceUrl, username: settings.serviceNow.username, password: settings.serviceNow.password, apiKey: settings.serviceNow.apiKey, authMethod: settings.serviceNow.authMethod });
      setSnTestResult(result);
    } catch (e: any) { setSnTestResult({ success: false, message: e.message }); }
    finally { setTestingSN(false); }
  };

  const handleTestShodan = async () => {
    if (!shodanApiKey) { setShodanTestResult({ success: false, message: "API key required" }); return; }
    setTestingShodan(true); setShodanTestResult(null);
    try {
      await saveAll(settings, general);
      const { data, error } = await supabase.functions.invoke("shodan-proxy", { body: { query: "test", type: "info", apiKey: shodanApiKey } });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data?.error || "Connection failed");
      setShodanTestResult({ success: true, message: "Shodan API connected & settings saved" });
    } catch (e: any) { setShodanTestResult({ success: false, message: e.message }); }
    finally { setTestingShodan(false); }
  };

  const handleTestDefender = async () => {
    if (!defenderTenantId || !defenderClientId || !defenderClientSecret) { setDefenderTestResult({ success: false, message: "All fields required" }); return; }
    setTestingDefender(true); setDefenderTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("defender-proxy", { body: { action: "test", tenantId: defenderTenantId, clientId: defenderClientId, clientSecret: defenderClientSecret } });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data?.error || "Connection failed");
      setDefenderTestResult({ success: true, message: "Microsoft Defender connection successful" });
    } catch (e: any) { setDefenderTestResult({ success: false, message: e.message }); }
    finally { setTestingDefender(false); }
  };

  const handleTestNmap = async () => {
    if (nmapMode !== "local") { setNmapTestResult({ success: true, message: "Cloud backend active — no local server needed." }); setDiscoveredTools([]); return; }
    setTestingNmap(true); setNmapTestResult(null); setDiscoveredTools([]);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
      if (nmapApiKey) headers["x-api-key"] = nmapApiKey;
      const resp = await fetch(`${nmapLocalUrl.replace(/\/$/, "")}/api/health`, { headers });
      const data = await resp.json();
      // New universal server format
      if (data.tools && typeof data.tools === "object") {
        const tools = Object.entries(data.tools).map(([id, info]: [string, any]) => ({ id, name: id, icon: "🔧", available: info.available, version: info.version, description: "", category: "misc", ...info }));
        setDiscoveredTools(tools);
        // Also try to get full tool metadata
        try {
          const toolsResp = await fetch(`${nmapLocalUrl.replace(/\/$/, "")}/api/tools`, { headers });
          const toolsData = await toolsResp.json();
          if (toolsData.tools) setDiscoveredTools(toolsData.tools.map((t: any) => ({ ...t, available: data.tools[t.id]?.available ?? false, version: data.tools[t.id]?.version })));
        } catch {}
        const availCount = tools.filter(t => t.available).length;
        setNmapTestResult({ success: availCount > 0, message: `Connected! ${data.server_version ? `Server v${data.server_version} — ` : ""}${availCount}/${tools.length} tool(s) available` });
      }
      // Legacy nmap-only format
      else if (data.status === "ok" && data.nmap) {
        setNmapTestResult({ success: true, message: `Connected! ${data.version}` });
        setDiscoveredTools([{ id: "nmap", name: "Nmap Network Scanner", icon: "🔍", available: true, version: data.version, description: "Network scanning", category: "network" }]);
      }
      else setNmapTestResult({ success: false, message: data.message || "Server reachable but no tools found" });
    } catch (e: any) { setNmapTestResult({ success: false, message: `Cannot reach server: ${e.message}` }); }
    finally { setTestingNmap(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop(); const path = `logo.${ext}`;
      await supabase.storage.from("org-assets").remove(["logo.png", "logo.jpg", "logo.jpeg", "logo.svg", "logo.webp"]);
      const { error } = await supabase.storage.from("org-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("org-assets").getPublicUrl(path);
      setGeneral(prev => ({ ...prev, logoUrl: urlData.publicUrl }));
      toast({ title: "Logo Uploaded" });
    } catch (err: any) { toast({ title: "Upload Failed", description: err.message, variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const removeLogo = () => setGeneral(prev => ({ ...prev, logoUrl: "" }));

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingIcon(true);
    try {
      const ext = file.name.split(".").pop(); const path = `sidebar-icon.${ext}`;
      await supabase.storage.from("org-assets").remove(["sidebar-icon.png", "sidebar-icon.jpg", "sidebar-icon.jpeg", "sidebar-icon.svg", "sidebar-icon.webp"]);
      const { error } = await supabase.storage.from("org-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("org-assets").getPublicUrl(path);
      setGeneral(prev => ({ ...prev, sidebarIconUrl: urlData.publicUrl }));
      toast({ title: "Icon Uploaded" });
    } catch (err: any) { toast({ title: "Upload Failed", description: err.message, variant: "destructive" }); }
    finally { setUploadingIcon(false); }
  };

  const removeIcon = () => setGeneral(prev => ({ ...prev, sidebarIconUrl: "" }));

  const aiModels = [
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Fast)" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Balanced)" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Best Quality)" },
    { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro (Next-Gen)" },
    { value: "openai/gpt-5-mini", label: "GPT-5 Mini (Fast)" },
    { value: "openai/gpt-5", label: "GPT-5 (High Quality)" },
    { value: "openai/gpt-5.2", label: "GPT-5.2 (Latest)" },
  ];

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
          <div className="p-4 rounded-full bg-muted"><Lock className="h-8 w-8 text-muted-foreground" /></div>
          <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Settings are restricted to Admin users. Current role: <Badge variant="secondary">{role || "user"}</Badge>
          </p>
        </div>
      </AppLayout>
    );
  }

  // --- Tab content renderer ---
  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <SectionCard title="Fetch Configuration" icon={Clock} description="Control how feeds are fetched and alerts triggered.">
            <FieldGroup label="RSS Fetch Interval" description="Cron expression — default: every 30 minutes">
              <Input value={general.fetchInterval} onChange={e => setGeneral(g => ({ ...g, fetchInterval: e.target.value }))} className="font-mono" placeholder="*/30 * * * *" />
            </FieldGroup>
            <FieldGroup label="Severity Threshold for Alerts">
              <Select value={general.severityThreshold} onValueChange={v => setGeneral(g => ({ ...g, severityThreshold: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["critical", "high", "medium", "low", "info"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldGroup>
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-sm font-medium">Duplicate Detection</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Prevent ingesting duplicate feed items</p>
              </div>
              <Switch checked={general.duplicateDetection} onCheckedChange={v => setGeneral(g => ({ ...g, duplicateDetection: v }))} />
            </div>
          </SectionCard>
        );

      case "branding":
        return (
          <div className="space-y-6">
            <SectionCard title="Application Name" icon={Palette} description="Displayed across sidebar, page title, and reports.">
              <FieldGroup label="App Name">
                <Input value={general.appName} onChange={e => setGeneral(g => ({ ...g, appName: e.target.value }))} placeholder="ThreatIntel" />
              </FieldGroup>
            </SectionCard>
            <SectionCard title="Organization Logo" icon={ImageIcon} description="Appears in the sidebar and generated reports.">
              <div className="flex items-center gap-6">
                {general.logoUrl ? (
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden shadow-sm">
                      <img src={general.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <button onClick={removeLogo} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, SVG or WEBP — max 2MB</p>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Sidebar Icon" icon={Shield} description="Custom icon for the sidebar header — recommended 28×28px.">
              <div className="flex items-center gap-6">
                {general.sidebarIconUrl ? (
                  <div className="relative group">
                    <div className="w-16 h-16 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden shadow-sm">
                      <img src={general.sidebarIconUrl} alt="Icon" className="max-w-full max-h-full object-contain" />
                    </div>
                    <button onClick={removeIcon} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
                <div className="space-y-2">
                  <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon}>
                    {uploadingIcon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploadingIcon ? "Uploading..." : "Upload Icon"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, SVG or WEBP — square format</p>
                </div>
              </div>
            </SectionCard>
          </div>
        );

      case "ai":
        return (
          <div className="space-y-6">
            <SectionCard title="AI Model Configuration" icon={Brain} description="Configure the AI provider used for threat analysis.">
              <FieldGroup label="AI Provider" description={
                settings.ai.apiType === "intelligence-studio" ? "Using Aptean Intelligence Studio API" :
                settings.ai.apiType === "openai-compatible" ? "Using custom OpenAI-compatible endpoint" :
                "Built-in AI — no API key needed"
              }>
                <Select value={settings.ai.apiType || "builtin"} onValueChange={(v) => {
                  if (v === "builtin") { updateAI("endpointUrl", ""); updateAI("apiKey", ""); updateAI("model", "google/gemini-3-flash-preview"); updateAI("apiType", "builtin"); updateAI("authHeaderType", "bearer"); }
                  else if (v === "intelligence-studio") { updateAI("apiType", "intelligence-studio"); updateAI("authHeaderType", "x-api-key"); updateAI("endpointUrl", " "); }
                  else { updateAI("apiType", "openai-compatible"); updateAI("authHeaderType", "bearer"); updateAI("endpointUrl", " "); }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builtin">Built-in AI (Lovable Gateway)</SelectItem>
                    <SelectItem value="openai-compatible">Custom / Self-Hosted (OpenAI-compatible)</SelectItem>
                    <SelectItem value="intelligence-studio">Intelligence Studio (Aptean)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>
              <FieldGroup label="AI Model">
                {settings.ai.apiType !== "builtin" ? (
                  <Input value={settings.ai.model} onChange={(e) => updateAI("model", e.target.value)} className="font-mono" placeholder={settings.ai.apiType === "intelligence-studio" ? "Flow ID or model name" : "gpt-4o, llama3, etc."} />
                ) : (
                  <Select value={settings.ai.model} onValueChange={(v) => updateAI("model", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{aiModels.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </FieldGroup>
              <div className="grid md:grid-cols-3 gap-4">
                <FieldGroup label="Max Tokens"><Input value={settings.ai.maxTokens} onChange={(e) => updateAI("maxTokens", e.target.value)} className="font-mono" /></FieldGroup>
                <FieldGroup label="Temperature"><Input value={settings.ai.temperature} onChange={(e) => updateAI("temperature", e.target.value)} className="font-mono" /></FieldGroup>
                <FieldGroup label="Timeout (s)"><Input value={settings.ai.timeout} onChange={(e) => updateAI("timeout", e.target.value)} className="font-mono" /></FieldGroup>
              </div>
            </SectionCard>

            {settings.ai.apiType !== "builtin" && (
              <SectionCard title={settings.ai.apiType === "intelligence-studio" ? "Intelligence Studio Configuration" : "Custom Endpoint"} icon={Key} description="Endpoint URL and authentication credentials.">
                <FieldGroup label="Endpoint URL" description={settings.ai.apiType === "intelligence-studio" ? "Full Intelligence Studio API URL including the flow/run ID" : "Supports Ollama, LM Studio, vLLM, Azure OpenAI, etc."}>
                  <Input value={settings.ai.endpointUrl?.trim() || ""} onChange={(e) => updateAI("endpointUrl", e.target.value)} className="font-mono" placeholder={settings.ai.apiType === "intelligence-studio" ? "https://appcentral-int.aptean.com/ais/api/v1/run/<flow-id>" : "http://localhost:11434/v1/chat/completions"} />
                </FieldGroup>
                <FieldGroup label="Authentication Header">
                  <Select value={settings.ai.authHeaderType || "bearer"} onValueChange={(v) => updateAI("authHeaderType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bearer">Authorization: Bearer (standard)</SelectItem>
                      <SelectItem value="x-api-key">x-api-key (Intelligence Studio)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup label="API Key" description={settings.ai.apiKey && !showAIKey ? maskSecret(settings.ai.apiKey) : undefined}>
                  <PasswordField value={settings.ai.apiKey} onChange={v => updateAI("apiKey", v)} show={showAIKey} onToggle={() => setShowAIKey(!showAIKey)} placeholder="sk-..." />
                </FieldGroup>
                <Button variant="outline" size="sm" onClick={handleTestAI} disabled={testingAI} className="gap-2">
                  {testingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
                </Button>
                <TestResultBadge result={aiTestResult} />
              </SectionCard>
            )}
          </div>
        );

      case "ai-prompts":
        return <AIPromptManager aiSettings={settings.ai} />;

      case "advisory-template":
        return (
          <div className="space-y-6">
            <SectionCard title="Advisory Email Template" icon={FileText} description="Customize the HTML template used when emailing AI analysis via Copy, Export, Email, and Ticket actions.">
              <div className="grid md:grid-cols-2 gap-4">
                <FieldGroup label="Organization Name" description="Shown in the email header">
                  <Input value={advisoryTemplate.orgName} onChange={e => setAdvisoryTemplate(c => ({ ...c, orgName: e.target.value }))} placeholder="Security & Compliance" />
                </FieldGroup>
                <FieldGroup label="Contact Email" description="Shown in the email footer">
                  <Input value={advisoryTemplate.contactEmail} onChange={e => setAdvisoryTemplate(c => ({ ...c, contactEmail: e.target.value }))} placeholder="security@yourcompany.com" className="font-mono text-sm" />
                </FieldGroup>
              </div>
              <FieldGroup label="Header Logo" description="Upload an image or enter a URL for the email header logo.">
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <Input value={advisoryTemplate.logoUrl} onChange={e => setAdvisoryTemplate(c => ({ ...c, logoUrl: e.target.value }))} placeholder="https://..." className="font-mono text-sm flex-1" />
                    <input type="file" ref={advisoryLogoInputRef} accept="image/*" className="hidden" onChange={handleUploadAdvisoryLogo} />
                    <Button type="button" variant="outline" size="sm" onClick={() => advisoryLogoInputRef.current?.click()} disabled={uploadingAdvisoryLogo} className="gap-1.5 shrink-0">
                      {uploadingAdvisoryLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload
                    </Button>
                    {advisoryTemplate.logoUrl && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => setAdvisoryTemplate(c => ({ ...c, logoUrl: "" }))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {advisoryTemplate.logoUrl && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                      <img src={advisoryTemplate.logoUrl} alt="Advisory logo preview" className="h-10 max-w-[160px] object-contain rounded" onError={e => (e.currentTarget.style.display = "none")} />
                      <span className="text-xs text-muted-foreground truncate">{advisoryTemplate.logoUrl}</span>
                    </div>
                  )}
                </div>
              </FieldGroup>
              <FieldGroup label="Footer Text">
                <Input value={advisoryTemplate.footerText} onChange={e => setAdvisoryTemplate(c => ({ ...c, footerText: e.target.value }))} placeholder="Generated by ThreatIntel AI Analysis" />
              </FieldGroup>
            </SectionCard>

            <SectionCard title="HTML Template" icon={MessageSquareCode} description="Edit the HTML template directly. Variables: {{org_name}}, {{logo_url}}, {{severity}}, {{summary}}, {{impact_html}}, {{versions_html}}, {{mitigations_html}}, {{references_html}}, {{contact_email}}, {{footer_text}}, {{title}}, {{source}}.">
              <FieldGroup label="Email Template (HTML)">
                <Textarea
                  value={advisoryTemplate.template}
                  onChange={e => setAdvisoryTemplate(c => ({ ...c, template: e.target.value }))}
                  className="font-mono text-xs min-h-[300px] leading-relaxed"
                />
              </FieldGroup>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdvisoryTemplate(c => ({ ...c, template: defaultAdvisoryTemplateDark }))} className="gap-2 text-xs">
                  🌑 Dark Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAdvisoryTemplate(c => ({ ...c, template: defaultAdvisoryTemplateLight }))} className="gap-2 text-xs">
                  ⬜ Light (B&W) Template
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Preview" icon={Eye} description="Live preview with sample data.">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-1 bg-background">
                  <div dangerouslySetInnerHTML={{
                    __html: advisoryTemplate.template
                      .replace(/\{\{org_name\}\}/g, advisoryTemplate.orgName)
                      .replace(/\{\{contact_email\}\}/g, advisoryTemplate.contactEmail)
                      .replace(/\{\{footer_text\}\}/g, advisoryTemplate.footerText)
                      .replace(/\{\{severity\}\}/g, "HIGH")
                      .replace(/\{\{title\}\}/g, "CVE-2026-12345 — Remote Code Execution in Example Software")
                      .replace(/\{\{source\}\}/g, "The Hacker News")
                      .replace(/\{\{summary\}\}/g, "A critical remote code execution vulnerability has been discovered in Example Software v3.x that allows unauthenticated attackers to execute arbitrary commands.")
                      .replace(/\{\{impact_html\}\}/g, "<li>Allows remote code execution without authentication</li><li>Affects all deployments running version 3.x</li><li>Could lead to full system compromise</li>")
                      .replace(/\{\{#has_versions\}\}([\s\S]*?)\{\{\/has_versions\}\}/g, "$1")
                      .replace(/\{\{\^has_versions\}\}([\s\S]*?)\{\{\/has_versions\}\}/g, "")
                      .replace(/\{\{versions_html\}\}/g, "<li>Example Software 3.0 – 3.4.2</li><li>Example Software 3.5-beta</li>")
                      .replace(/\{\{mitigations_html\}\}/g, "<li>Update to version 3.4.3 or later immediately</li><li>Apply the vendor-provided security patch</li><li>Restrict network access to affected services</li>")
                      .replace(/\{\{references_html\}\}/g, '<li><a href="#" style="color:#e94560;">https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2026-12345</a></li><li><a href="#" style="color:#e94560;">https://example.com/security/advisory-2026-001</a></li>')
                      .replace(/\{\{#logo_url\}\}([\s\S]*?)\{\{\/logo_url\}\}/g, advisoryTemplate.logoUrl ? "$1" : "")
                      .replace(/\{\{logo_url\}\}/g, advisoryTemplate.logoUrl || "")
                  }} />
                </div>
              </div>
            </SectionCard>

            <Button onClick={saveAdvisoryTemplate} className="gap-2" disabled={savingAdvisory}>
              {savingAdvisory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingAdvisory ? "Saving..." : "Save Advisory Template"}
            </Button>
          </div>
        );

      case "localtools":
        return (
          <div className="space-y-6">
            <SectionCard title="Scan Backend Mode" icon={Server} description="Choose between cloud TCP scanner or local tools server with full binary execution.">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { mode: "cloud", emoji: "☁️", title: "Cloud Backend", desc: "Simulated TCP-connect scanning. No local setup." },
                  { mode: "local", emoji: "🖥️", title: "Local Tools Server", desc: "Real binaries: Nmap, and any custom plugins you add." },
                ].map(opt => (
                  <button key={opt.mode} onClick={() => updateNmapBackend("mode", opt.mode)}
                    className={cn("border rounded-xl p-4 text-left transition-all", nmapMode === opt.mode ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50")}>
                    <p className="text-sm font-semibold text-foreground">{opt.emoji} {opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </SectionCard>

            {nmapMode === "local" && (
              <>
                <SectionCard title="Server Connection" icon={Globe} description="Connect to your local tools server instance.">
                  <FieldGroup label="Server URL" description="URL of your local tools server">
                    <Input value={nmapLocalUrl} onChange={e => updateNmapBackend("localUrl", e.target.value)} className="font-mono" placeholder="http://localhost:3001" />
                  </FieldGroup>
                  <FieldGroup label="API Key (optional)">
                    <PasswordField value={nmapApiKey} onChange={v => updateNmapBackend("apiKey", v)} show={showNmapKey} onToggle={() => setShowNmapKey(!showNmapKey)} placeholder="Leave empty if not configured" />
                  </FieldGroup>
                  <Button onClick={handleTestNmap} disabled={testingNmap} variant="outline" className="gap-2">
                    {testingNmap ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Test Connection & Discover Tools
                  </Button>
                  <TestResultBadge result={nmapTestResult} />
                </SectionCard>

                {/* Discovered tools */}
                {discoveredTools.length > 0 && (
                  <SectionCard title="Discovered Tools" icon={Settings2} description={`${discoveredTools.filter(t => t.available).length} of ${discoveredTools.length} plugin(s) available on the server.`}>
                    <div className="space-y-2">
                      {discoveredTools.map(tool => (
                        <div key={tool.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors",
                          tool.available ? "border-[hsl(var(--severity-low))]/30 bg-[hsl(var(--severity-low))]/5" : "border-destructive/30 bg-destructive/5"
                        )}>
                          <span className="text-lg">{tool.icon || "🔧"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{tool.name}</span>
                              {tool.version && <Badge variant="secondary" className="text-[9px]">{tool.version}</Badge>}
                              <Badge variant="outline" className="text-[9px] capitalize">{tool.category}</Badge>
                            </div>
                            {tool.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tool.description}</p>}
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] shrink-0",
                            tool.available
                              ? "bg-[hsl(var(--severity-low))]/10 text-[hsl(var(--severity-low))] border-[hsl(var(--severity-low))]/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          )}>
                            {tool.available ? "✓ Available" : "✗ Missing"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                <SectionCard title="Setup Instructions" icon={FileText} description="How to set up the local tools server.">
                  <div className="border border-dashed border-border rounded-xl p-4 bg-muted/10">
                    <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>Install Node.js 18+ and required tool binaries (e.g. Nmap)</li>
                      <li>Navigate to <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">local-tools-server/</code></li>
                      <li>Run <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">npm install</code></li>
                      <li>Start with <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">sudo node server.js</code></li>
                      <li>Optionally set <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">TOOLS_API_KEY=your-key</code></li>
                    </ol>
                  </div>
                  <div className="border border-dashed border-border rounded-xl p-4 bg-muted/10">
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">🔌 Adding Custom Tools</h4>
                    <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>Copy <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">plugins/_template.js</code> → <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">plugins/my-tool.js</code></li>
                      <li>Implement <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">metadata</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">healthCheck()</code>, and <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">registerRoutes(router)</code></li>
                      <li>Restart the server — the plugin auto-registers</li>
                    </ol>
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        );

      case "email":
        return (
          <SectionCard title="SMTP Configuration" icon={Mail} description="Outbound email settings for alerts and reports.">
            <div className="grid md:grid-cols-2 gap-4">
              <FieldGroup label="SMTP Host"><Input value={settings.smtp.host} onChange={(e) => updateSmtp("host", e.target.value)} className="font-mono" placeholder="smtp.gmail.com" /></FieldGroup>
              <FieldGroup label="Port"><Input value={settings.smtp.port} onChange={(e) => updateSmtp("port", e.target.value)} className="font-mono" placeholder="587" /></FieldGroup>
            </div>
            <FieldGroup label="Username"><Input value={settings.smtp.username} onChange={(e) => updateSmtp("username", e.target.value)} placeholder="your-email@example.com" /></FieldGroup>
            <FieldGroup label="Password">
              <PasswordField value={settings.smtp.password} onChange={v => updateSmtp("password", v)} show={showSmtpPass} onToggle={() => setShowSmtpPass(!showSmtpPass)} placeholder="App password" />
            </FieldGroup>
            <FieldGroup label="From Address"><Input value={settings.smtp.from} onChange={(e) => updateSmtp("from", e.target.value)} placeholder="threatintel@yourcompany.com" /></FieldGroup>
          </SectionCard>
        );

      case "servicenow":
        return (
          <div className="space-y-6">
            <SectionCard title="ServiceNow Connection" icon={Ticket} description="Configure ServiceNow instance for ticket creation.">
              <FieldGroup label="Instance URL"><Input value={settings.serviceNow.instanceUrl} onChange={(e) => updateServiceNow("instanceUrl", e.target.value)} className="font-mono" placeholder="https://yourinstance.service-now.com" /></FieldGroup>
              <FieldGroup label="Authentication Method">
                <Select value={settings.serviceNow.authMethod} onValueChange={(v) => updateServiceNow("authMethod", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic Auth (Username/Password)</SelectItem>
                    <SelectItem value="bearer">Bearer Token (API Key)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>
              {settings.serviceNow.authMethod === "basic" && (
                <>
                  <FieldGroup label="Username"><Input value={settings.serviceNow.username} onChange={(e) => updateServiceNow("username", e.target.value)} placeholder="admin" /></FieldGroup>
                  <FieldGroup label="Password">
                    <PasswordField value={settings.serviceNow.password} onChange={v => updateServiceNow("password", v)} show={showSnowPass} onToggle={() => setShowSnowPass(!showSnowPass)} placeholder="ServiceNow password" />
                  </FieldGroup>
                </>
              )}
              {settings.serviceNow.authMethod === "bearer" && (
                <FieldGroup label="API Key / Bearer Token" description={settings.serviceNow.apiKey && !showSnowKey ? maskSecret(settings.serviceNow.apiKey) : undefined}>
                  <PasswordField value={settings.serviceNow.apiKey} onChange={v => updateServiceNow("apiKey", v)} show={showSnowKey} onToggle={() => setShowSnowKey(!showSnowKey)} placeholder="Bearer token" />
                </FieldGroup>
              )}
              <FieldGroup label="Table Name"><Input value={settings.serviceNow.tableName} onChange={(e) => updateServiceNow("tableName", e.target.value)} className="font-mono" placeholder="incident" /></FieldGroup>
              <Button variant="outline" size="sm" onClick={handleTestSN} disabled={testingSN} className="gap-2">
                {testingSN ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
              </Button>
              <TestResultBadge result={snTestResult} />
            </SectionCard>
            <SectionCard title="Field Mapping" icon={ArrowRightLeft} description="Map ThreatIntel fields to ServiceNow fields.">
              <div className="grid md:grid-cols-2 gap-4">
                {(["title", "description", "priority", "category"] as const).map(field => (
                  <FieldGroup key={field} label={`${field.charAt(0).toUpperCase() + field.slice(1)} → Field`}>
                    <Input value={settings.serviceNow.fieldMapping[field]} onChange={(e) => updateFieldMapping(field, e.target.value)} className="font-mono" />
                  </FieldGroup>
                ))}
              </div>
            </SectionCard>
          </div>
        );

      case "shodan":
        return (
          <SectionCard title="Shodan API Configuration" icon={Globe} description="External attack surface intelligence via Shodan.">
            <div className="flex items-center justify-between py-1">
              <Label className="text-sm font-medium">Enable Shodan Integration</Label>
              <Switch checked={shodanEnabled} onCheckedChange={v => updateShodan("enabled", v)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from <a href="https://account.shodan.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">account.shodan.io</a>
            </p>
            <FieldGroup label="API Key" description={shodanApiKey && !showShodanKey ? maskSecret(shodanApiKey) : undefined}>
              <PasswordField value={shodanApiKey} onChange={v => updateShodan("apiKey", v)} show={showShodanKey} onToggle={() => setShowShodanKey(!showShodanKey)} placeholder="Enter your Shodan API key" />
            </FieldGroup>
            <Button variant="outline" size="sm" onClick={handleTestShodan} disabled={testingShodan || !shodanApiKey} className="gap-2">
              {testingShodan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
            </Button>
            <TestResultBadge result={shodanTestResult} />
          </SectionCard>
        );

      case "defender":
        return (
          <SectionCard title="Microsoft Defender Configuration" icon={Shield} description="Azure AD App Registration with Defender for Endpoint permissions.">
            <div className="flex items-center justify-between py-1">
              <Label className="text-sm font-medium">Enable Defender Integration</Label>
              <Switch checked={defenderEnabled} onCheckedChange={v => updateDefender("enabled", v)} />
            </div>
            <FieldGroup label="Tenant ID"><Input value={defenderTenantId} onChange={(e) => updateDefender("tenantId", e.target.value)} className="font-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></FieldGroup>
            <FieldGroup label="Client ID (Application ID)"><Input value={defenderClientId} onChange={(e) => updateDefender("clientId", e.target.value)} className="font-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></FieldGroup>
            <FieldGroup label="Client Secret" description={defenderClientSecret && !showDefenderSecret ? maskSecret(defenderClientSecret) : undefined}>
              <PasswordField value={defenderClientSecret} onChange={v => updateDefender("clientSecret", v)} show={showDefenderSecret} onToggle={() => setShowDefenderSecret(!showDefenderSecret)} placeholder="Client secret value" />
            </FieldGroup>
            <Button variant="outline" size="sm" onClick={handleTestDefender} disabled={testingDefender || !defenderTenantId || !defenderClientId || !defenderClientSecret} className="gap-2">
              {testingDefender ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test Connection
            </Button>
            <TestResultBadge result={defenderTestResult} />
          </SectionCard>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <SectionCard title="Notification Provider" icon={Bell} description="Configure how alerts are delivered.">
              <FieldGroup label="Provider">
                <Select value={general.notifyProvider} onValueChange={v => setGeneral(g => ({ ...g, notifyProvider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["slack", "email", "webhook", "telegram", "discord"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldGroup>
              <FieldGroup label="Webhook / API URL"><Input value={general.webhookUrl} onChange={e => setGeneral(g => ({ ...g, webhookUrl: e.target.value }))} className="font-mono" placeholder="https://hooks.slack.com/services/..." /></FieldGroup>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm font-medium">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Send alerts to configured email</p>
                </div>
                <Switch checked={general.emailEnabled} onCheckedChange={v => setGeneral(g => ({ ...g, emailEnabled: v }))} />
              </div>
            </SectionCard>

            <SectionCard title="RansomLook Watchlist Notifications" icon={Eye} iconColor="text-severity-high" description="Get alerted when watched organizations appear in ransomware leak data.">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm font-medium">Enable Watchlist Alerts</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically check new leaks against your watchlist</p>
                </div>
                <Switch checked={watchlistNotify.enabled} onCheckedChange={v => setWatchlistNotify(c => ({ ...c, enabled: v }))} />
              </div>
              <FieldGroup label="Notification Recipients" description="Comma-separated email addresses">
                <Input value={watchlistNotify.recipients} onChange={e => setWatchlistNotify(c => ({ ...c, recipients: e.target.value }))} className="font-mono text-sm" placeholder="user@company.com, soc@company.com" />
              </FieldGroup>
              <div className="grid md:grid-cols-2 gap-4">
                <FieldGroup label="Check Frequency">
                  <Select value={watchlistNotify.frequency} onValueChange={v => setWatchlistNotify(c => ({ ...c, frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly Digest</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Digest</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Notification Method">
                  <Select value={watchlistNotify.method} onValueChange={v => setWatchlistNotify(c => ({ ...c, method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email (via SMTP)</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>

              {watchlistNotify.method === "email" && (
                <SectionCard title="Watchlist Alert Email Template" icon={FileText} description="Customize the HTML email sent when watchlist matches are found. Use variables: {{match_count}}, {{matches_html}}, {{app_name}}, {{date}}.">
                  <FieldGroup label="Email Template (HTML)" description="Variables: {{match_count}}, {{matches_html}}, {{app_name}}, {{date}}">
                    <Textarea
                      value={watchlistNotify.emailTemplate}
                      onChange={e => setWatchlistNotify(c => ({ ...c, emailTemplate: e.target.value }))}
                      className="font-mono text-xs min-h-[250px] leading-relaxed"
                    />
                  </FieldGroup>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setWatchlistNotify(c => ({ ...c, emailTemplate: defaultWatchlistTemplate }))} className="gap-2 text-xs">
                      Reset to Default
                    </Button>
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-muted/30 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground">Preview</p>
                    </div>
                    <div className="p-4 bg-background">
                      <div dangerouslySetInnerHTML={{
                        __html: watchlistNotify.emailTemplate
                          .replace(/\{\{match_count\}\}/g, "2")
                          .replace(/\{\{app_name\}\}/g, general.appName || "ThreatIntel")
                          .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
                          .replace(/\{\{matches_html\}\}/g, `
                            <div style="margin-bottom: 16px; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden;">
                              <div style="background: #fef2f2; padding: 12px 16px; border-bottom: 1px solid #fecaca;">
                                <span style="color: #dc2626; font-weight: 700;">🔴 Acme Corp</span>
                                <span style="color: #6b7280; font-size: 13px;"> — 3 post(s)</span>
                              </div>
                              <ul style="padding: 12px 16px 12px 32px; margin: 0; color: #374151; font-size: 13px; line-height: 1.8;">
                                <li><strong>LockBit</strong>: acme-corp.com — Jan 15, 2026</li>
                                <li><strong>BlackCat</strong>: acme data dump — Jan 14, 2026</li>
                              </ul>
                            </div>
                          `)
                      }} />
                    </div>
                  </div>
                </SectionCard>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleSaveWatchlistNotify} disabled={savingWatchlistNotify} size="sm" className="gap-2">
                  {savingWatchlistNotify ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Watchlist Settings
                </Button>
                <Button variant="outline" size="sm" onClick={handleTestWatchlistCheck} disabled={testingWatchlist} className="gap-2">
                  {testingWatchlist ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Test Now
                </Button>
              </div>
              <TestResultBadge result={watchlistTestResult} />
            </SectionCard>
          </div>
        );

      case "template":
        return (
          <SectionCard title="Alert Template" icon={Shield} description="Customize the alert email template with variables.">
            <FieldGroup label="Template" description='Variables: {{title}}, {{severity}}, {{source}}, {{date}}, {{description}}, {{link}}'>
              <Textarea value={general.alertTemplate} onChange={e => setGeneral(g => ({ ...g, alertTemplate: e.target.value }))} className="font-mono text-xs min-h-[180px]" />
            </FieldGroup>
          </SectionCard>
        );

      case "reports":
        return (
          <div className="space-y-6">
            <SectionCard title="Report Branding" icon={FileText} description="Organization info shown in generated PDF/HTML reports.">
              <div className="grid md:grid-cols-2 gap-4">
                <FieldGroup label="Organization Name"><Input value={reportConfig.orgName} onChange={e => setReportConfig(c => ({ ...c, orgName: e.target.value }))} placeholder="Your Organization" /></FieldGroup>
                <FieldGroup label="Report Title"><Input value={reportConfig.reportTitle} onChange={e => setReportConfig(c => ({ ...c, reportTitle: e.target.value }))} placeholder="Security Scan Report" /></FieldGroup>
              </div>
              <FieldGroup label="Header Text (optional)"><Input value={reportConfig.headerText} onChange={e => setReportConfig(c => ({ ...c, headerText: e.target.value }))} placeholder="Internal Use Only" /></FieldGroup>
              <FieldGroup label="Footer / Disclaimer"><Textarea value={reportConfig.footerText} onChange={e => setReportConfig(c => ({ ...c, footerText: e.target.value }))} className="text-sm" rows={2} /></FieldGroup>
              <FieldGroup label="Logo URL" description="Leave empty to use the organization logo from Branding tab.">
                <Input value={reportConfig.logoUrl} onChange={e => setReportConfig(c => ({ ...c, logoUrl: e.target.value }))} className="font-mono text-sm" placeholder="https://..." />
              </FieldGroup>
            </SectionCard>
            <SectionCard title="Appearance" icon={Palette} description="Report visual styling.">
              <div className="grid md:grid-cols-2 gap-4">
                <FieldGroup label="Primary Color">
                  <div className="flex gap-2">
                    <input type="color" value={reportConfig.primaryColor} onChange={e => setReportConfig(c => ({ ...c, primaryColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={reportConfig.primaryColor} onChange={e => setReportConfig(c => ({ ...c, primaryColor: e.target.value }))} className="font-mono" />
                  </div>
                </FieldGroup>
                <FieldGroup label="Date/Time Format">
                  <Select value={reportConfig.dateFormat} onValueChange={v => setReportConfig(c => ({ ...c, dateFormat: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MMM d, yyyy HH:mm">MMM d, yyyy HH:mm</SelectItem>
                      <SelectItem value="yyyy-MM-dd HH:mm:ss">yyyy-MM-dd HH:mm:ss</SelectItem>
                      <SelectItem value="dd/MM/yyyy HH:mm">dd/MM/yyyy HH:mm</SelectItem>
                      <SelectItem value="MM/dd/yyyy hh:mm a">MM/dd/yyyy hh:mm a</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>
            </SectionCard>
            <SectionCard title="Sections to Include" icon={Settings2} description="Choose which sections appear in generated reports.">
              <div className="grid md:grid-cols-2 gap-3">
                {([
                  { key: "summary", label: "Scan Summary" },
                  { key: "hostDetails", label: "Host & Port Details" },
                  { key: "aiAnalysis", label: "AI Security Analysis" },
                  { key: "remediation", label: "Remediation Recommendations" },
                  { key: "firewallRules", label: "Firewall Hardening Rules" },
                  { key: "patchRecommendations", label: "Patch Recommendations" },
                ] as const).map(section => (
                  <div key={section.key} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <Checkbox id={`section-${section.key}`} checked={reportConfig.includeSections[section.key]}
                      onCheckedChange={(v) => setReportConfig(c => ({ ...c, includeSections: { ...c.includeSections, [section.key]: !!v } }))} />
                    <Label htmlFor={`section-${section.key}`} className="text-sm cursor-pointer">{section.label}</Label>
                  </div>
                ))}
              </div>
            </SectionCard>
            <Button onClick={saveReportConfig} className="gap-2" disabled={savingReport}>
              {savingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingReport ? "Saving..." : "Save Report Settings"}
            </Button>
          </div>
        );

      case "infrastructure":
        return (
          <div className="space-y-6">
            <SectionCard
              title="Backend Services Health"
              icon={Activity}
              description="Verify all Docker backend services are reachable and healthy"
            >
              <HealthCheckPanel
                nmapUrl={nmapLocalUrl}
                toolsUrl={settings.nmapBackend?.toolsUrl || ""}
                autoCheck
              />
            </SectionCard>

            <SectionCard
              title="Custom Endpoints"
              icon={Server}
              description="Override endpoint URLs for health checks (useful for custom Docker setups)"
            >
              <FieldGroup label="Nmap / Tools Server URL" description="Used for the Nmap local backend and health check">
                <Input
                  value={nmapLocalUrl}
                  onChange={e => updateNmapBackend("localUrl", e.target.value)}
                  placeholder="http://localhost:3001"
                  className="font-mono text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Tools Server URL" description="Separate tools server (port 3002 by default in Docker)">
                <Input
                  value={settings.nmapBackend?.toolsUrl || ""}
                  onChange={e => updateNmapBackend("toolsUrl", e.target.value)}
                  placeholder="http://localhost:3002"
                  className="font-mono text-sm"
                />
              </FieldGroup>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                💡 When running via Docker Compose, the Nmap server is on port <code className="font-mono">3001</code> and the Tools server on <code className="font-mono">3002</code> by default.
              </p>
            </SectionCard>
          </div>
        );

      default:
        return null;
    }
  };

  const activeNavItem = navItems.find(n => n.id === activeTab);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-0px)]">
        {/* Sidebar Navigation */}
        <div className="w-64 shrink-0 border-r border-border bg-card/50">
          <div className="px-5 py-5 border-b border-border">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10"><Settings2 className="h-4 w-4 text-primary" /></div>
              Settings
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5">Platform configuration</p>
          </div>
          <ScrollArea className="h-[calc(100vh-90px)]">
            <nav className="p-3 space-y-0.5">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group",
                    activeTab === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", activeTab === item.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  {activeTab === item.id && <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 text-primary/60" />}
                </button>
              ))}
            </nav>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
              {/* Page header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{activeNavItem?.label}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{activeNavItem?.description}</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save All"}
                </Button>
              </div>
              <Separator />
              {renderContent()}
            </div>
          </ScrollArea>
        </div>
      </div>
    </AppLayout>
  );
}
