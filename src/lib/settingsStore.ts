// Simple localStorage-based settings store
const SETTINGS_KEY = "threatintel_settings";

export interface SmtpConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  from: string;
}

export interface ServiceNowConfig {
  instanceUrl: string;
  username: string;
  password: string;
  tableName: string;
  apiKey: string;
  authMethod: "basic" | "bearer" | "oauth";
  fieldMapping: {
    title: string;
    description: string;
    priority: string;
    category: string;
  };
}

export interface AIConfig {
  model: string;
  apiKey: string;
  endpointUrl: string;
  maxTokens: string;
  timeout: string;
  temperature: string;
  apiType: "builtin" | "openai-compatible" | "intelligence-studio";
  authHeaderType: "bearer" | "x-api-key";
}

export interface AppSettings {
  smtp: SmtpConfig;
  serviceNow: ServiceNowConfig;
  ai: AIConfig;
}

const defaultSettings: AppSettings = {
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
    apiType: "builtin",
    authHeaderType: "bearer",
  },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      smtp: { ...defaultSettings.smtp, ...parsed.smtp },
      serviceNow: {
        ...defaultSettings.serviceNow,
        ...parsed.serviceNow,
        fieldMapping: { ...defaultSettings.serviceNow.fieldMapping, ...parsed.serviceNow?.fieldMapping },
      },
      ai: { ...defaultSettings.ai, ...parsed.ai },
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

export function maskSecret(value: string): string {
  if (!value || value.length <= 4) return "••••••••";
  return "••••••••" + value.slice(-4);
}
