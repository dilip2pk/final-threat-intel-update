import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppSettings } from "@/lib/settingsStore";

export interface ShodanConfig {
  apiKey: string;
  enabled: boolean;
}

export interface DefenderConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

export interface ExtendedSettings extends AppSettings {
  shodan?: ShodanConfig;
  defender?: DefenderConfig;
  [key: string]: any;
}

const defaultSettings: ExtendedSettings = {
  smtp: { host: "", port: "587", username: "", password: "", from: "" },
  serviceNow: {
    instanceUrl: "",
    username: "",
    password: "",
    tableName: "incident",
    apiKey: "",
    authMethod: "basic",
    fieldMapping: {
      title: "short_description",
      description: "description",
      priority: "priority",
      category: "category",
    },
  },
  ai: {
    model: "google/gemini-3-flash-preview",
    apiKey: "",
    endpointUrl: "",
    maxTokens: "4096",
    timeout: "30",
    temperature: "0.3",
  },
  shodan: { apiKey: "", enabled: false },
  defender: { tenantId: "", clientId: "", clientSecret: "", enabled: false },
};

interface GeneralSettings {
  fetchInterval: string;
  severityThreshold: string;
  duplicateDetection: boolean;
  notifyProvider: string;
  webhookUrl: string;
  emailEnabled: boolean;
  alertTemplate: string;
  logoUrl: string;
  appName: string;
}

const defaultGeneral: GeneralSettings = {
  fetchInterval: "*/30 * * * *",
  severityThreshold: "high",
  duplicateDetection: true,
  notifyProvider: "slack",
  webhookUrl: "",
  emailEnabled: false,
  alertTemplate: `🚨 **{{severity}}** — {{title}}\n\nSource: {{source}}\nPublished: {{date}}\n\n{{description}}\n\n🔗 {{link}}`,
  logoUrl: "",
  appName: "ThreatIntel",
};

export function useSettings() {
  const [settings, setSettings] = useState<ExtendedSettings>(defaultSettings);
  const [general, setGeneral] = useState<GeneralSettings>(defaultGeneral);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings from DB
  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("key, value");
        
        if (data) {
          for (const row of data) {
            if (row.key === "integrations") {
              const val = row.value as any;
              setSettings({
                smtp: { ...defaultSettings.smtp, ...val?.smtp },
                serviceNow: {
                  ...defaultSettings.serviceNow,
                  ...val?.serviceNow,
                  fieldMapping: { ...defaultSettings.serviceNow.fieldMapping, ...val?.serviceNow?.fieldMapping },
                },
                ai: { ...defaultSettings.ai, ...val?.ai },
                shodan: { ...defaultSettings.shodan!, ...val?.shodan },
                defender: { ...defaultSettings.defender!, ...val?.defender },
              });
            } else if (row.key === "general") {
              setGeneral({ ...defaultGeneral, ...(row.value as any) });
            }
          }
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const saveAll = useCallback(async (newSettings: ExtendedSettings, newGeneral: GeneralSettings) => {
    setSaving(true);
    try {
      // Upsert integrations
      await supabase
        .from("app_settings")
        .upsert({ key: "integrations", value: newSettings as any }, { onConflict: "key" });

      // Upsert general
      await supabase
        .from("app_settings")
        .upsert({ key: "general", value: newGeneral as any }, { onConflict: "key" });

      setSettings(newSettings);
      setGeneral(newGeneral);
      return true;
    } catch (e) {
      console.error("Failed to save settings:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, setSettings, general, setGeneral, loading, saving, saveAll };
}

export function useAlertRules() {
  const [rules, setRules] = useState<Array<{
    id: string;
    name: string;
    keywords: string[];
    severity_threshold: string;
    url_pattern: string;
    active: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const loadRules = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("alert_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setRules(data);
    } catch (e) {
      console.error("Failed to load alert rules:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const addRule = useCallback(async (rule: { name: string; keywords: string[]; severity_threshold: string; url_pattern: string; active: boolean }) => {
    const { data, error } = await supabase
      .from("alert_rules")
      .insert(rule)
      .select()
      .single();
    if (data) setRules(prev => [data, ...prev]);
    return { data, error };
  }, []);

  const updateRule = useCallback(async (id: string, updates: Partial<typeof rules[0]>) => {
    const { error } = await supabase
      .from("alert_rules")
      .update(updates)
      .eq("id", id);
    if (!error) setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    return { error };
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("alert_rules")
      .delete()
      .eq("id", id);
    if (!error) setRules(prev => prev.filter(r => r.id !== id));
    return { error };
  }, []);

  return { rules, loading, addRule, updateRule, deleteRule, reloadRules: loadRules };
}

export function useWatchlist() {
  const [items, setItems] = useState<Array<{
    id: string;
    organization: string;
    notify_method: string;
    notify_frequency: string;
    active: boolean;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("watchlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setItems(data);
    } catch (e) {
      console.error("Failed to load watchlist:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const addItem = useCallback(async (item: { organization: string; notify_method: string; notify_frequency: string }) => {
    const { data, error } = await supabase
      .from("watchlist")
      .insert(item)
      .select()
      .single();
    if (data) setItems(prev => [data, ...prev]);
    return { data, error };
  }, []);

  const removeItem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", id);
    if (!error) setItems(prev => prev.filter(i => i.id !== id));
    return { error };
  }, []);

  return { items, loading, addItem, removeItem, reloadItems: loadItems };
}

export type { GeneralSettings };
