import { useState, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Save, Bell, Clock, Shield, Mail, Ticket, Brain, Eye, EyeOff, Zap, Loader2,
  CheckCircle2, XCircle, Key, Globe, Settings2, ArrowRightLeft, Upload, Image as ImageIcon, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskSecret } from "@/lib/settingsStore";
import { testAIConnection, testServiceNowConnection } from "@/lib/api";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings, setSettings, general, setGeneral, loading, saving, saveAll } = useSettings();

  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showSnowPass, setShowSnowPass] = useState(false);
  const [showAIKey, setShowAIKey] = useState(false);
  const [showSnowKey, setShowSnowKey] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingSN, setTestingSN] = useState(false);
  const [snTestResult, setSnTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const result = await testAIConnection({ model: settings.ai.model, endpointUrl: settings.ai.endpointUrl, apiKey: settings.ai.apiKey, timeout: settings.ai.timeout });
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo.${ext}`;
      // Remove old logo first
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading settings...</span>
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
            <TabsTrigger value="email">Email (SMTP)</TabsTrigger>
            <TabsTrigger value="servicenow">ServiceDesk</TabsTrigger>
            <TabsTrigger value="shodan">Shodan</TabsTrigger>
            <TabsTrigger value="defender">Defender</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="template">Alert Template</TabsTrigger>
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
          </TabsContent>

          {/* AI Integration Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> AI Model Configuration
              </h2>
              <div>
                <Label>AI Model</Label>
                <Select value={settings.ai.model} onValueChange={(v) => updateAI("model", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {aiModels.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Custom AI API (Optional)
              </h2>
              <p className="text-xs text-muted-foreground">Leave blank to use the built-in AI service.</p>
              <div>
                <Label>Custom Endpoint URL</Label>
                <Input value={settings.ai.endpointUrl} onChange={(e) => updateAI("endpointUrl", e.target.value)} className="mt-1 font-mono" placeholder="https://api.openai.com/v1/chat/completions" />
              </div>
              <div>
                <Label>API Key</Label>
                <div className="relative mt-1">
                  <Input type={showAIKey ? "text" : "password"} value={settings.ai.apiKey} onChange={(e) => updateAI("apiKey", e.target.value)} placeholder="sk-..." className="font-mono" />
                  <button type="button" onClick={() => setShowAIKey(!showAIKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {settings.ai.apiKey && !showAIKey && <p className="text-xs text-muted-foreground mt-1 font-mono">{maskSecret(settings.ai.apiKey)}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleTestAI} disabled={testingAI} className="gap-2">
                  {testingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Test AI Connection
                </Button>
              </div>
              <TestResultBadge result={aiTestResult} />
            </div>
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
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Shodan API Configuration
              </h2>
              <p className="text-xs text-muted-foreground">
                Get your API key from <a href="https://account.shodan.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">account.shodan.io</a>.
                The key is stored securely as a backend secret.
              </p>
              <div className="p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
                <p>API key must be configured as a backend secret named <code className="font-mono text-primary">SHODAN_API_KEY</code>.</p>
                <p className="mt-1">Contact your administrator to configure this secret.</p>
              </div>
            </div>
          </TabsContent>

          {/* Defender Tab */}
          <TabsContent value="defender" className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Microsoft Defender Configuration
              </h2>
              <p className="text-xs text-muted-foreground">
                Requires Azure AD App Registration with Microsoft Defender for Endpoint permissions.
              </p>
              <div className="p-3 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground space-y-1">
                <p>The following backend secrets must be configured:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><code className="font-mono text-primary">DEFENDER_TENANT_ID</code> — Azure AD tenant ID</li>
                  <li><code className="font-mono text-primary">DEFENDER_CLIENT_ID</code> — Application (client) ID</li>
                  <li><code className="font-mono text-primary">DEFENDER_CLIENT_SECRET</code> — Client secret value</li>
                </ul>
                <p className="mt-1">Contact your administrator to configure these secrets.</p>
              </div>
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
        </Tabs>

        <Button onClick={handleSave} className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </AppLayout>
  );
}
