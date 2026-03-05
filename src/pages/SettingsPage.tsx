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
  CheckCircle2, XCircle, Key, Globe, Settings2, ArrowRightLeft, Upload, Image as ImageIcon, Trash2, Lock, FileText, Palette,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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


        </Tabs>

        <Button onClick={handleSave} className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </AppLayout>
  );
}
