import { supabase } from "@/integrations/supabase/client";
import type { AppSettings, SmtpConfig, ServiceNowConfig } from "@/lib/settingsStore";

const defaultSettings: AppSettings = {
  smtp: { host: "", port: "587", username: "", password: "", from: "" },
  serviceNow: {
    instanceUrl: "", username: "", password: "", tableName: "incident",
    apiKey: "", authMethod: "basic",
    fieldMapping: { title: "short_description", description: "description", priority: "priority", category: "category" },
  },
  ai: {
    model: "google/gemini-3-flash-preview", apiKey: "", endpointUrl: "",
    maxTokens: "4096", timeout: "30", temperature: "0.3",
  },
};

export async function loadSettingsFromDB(): Promise<AppSettings> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", "integrations")
      .single();

    if (data) {
      const val = data.value as any;
      return {
        smtp: { ...defaultSettings.smtp, ...val?.smtp },
        serviceNow: {
          ...defaultSettings.serviceNow,
          ...val?.serviceNow,
          fieldMapping: { ...defaultSettings.serviceNow.fieldMapping, ...val?.serviceNow?.fieldMapping },
        },
        ai: { ...defaultSettings.ai, ...val?.ai },
      };
    }
  } catch (e) {
    console.error("Failed to load settings from DB:", e);
  }
  return defaultSettings;
}

export function isSmtpConfigured(smtp: SmtpConfig): boolean {
  return !!(smtp.host && smtp.port && smtp.username && smtp.password && smtp.from);
}

export function isServiceNowConfigured(config: ServiceNowConfig): boolean {
  if (config.authMethod === "bearer") {
    return !!(config.instanceUrl && config.apiKey);
  }
  return !!(config.instanceUrl && config.username && config.password);
}
