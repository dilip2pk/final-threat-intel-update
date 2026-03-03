import { supabase } from "@/integrations/supabase/client";

export interface AIAnalysis {
  summary: string;
  impact_analysis: string;
  affected_versions: string[];
  mitigations: string[];
  reference_links: string[];
  severity: string;
}

export async function analyzeFeed(params: {
  title: string;
  description: string;
  content?: string;
  source?: string;
  model?: string;
}): Promise<AIAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-feed", {
    body: params,
  });

  if (error) throw new Error(error.message || "Failed to analyze feed");
  if (!data?.success) throw new Error(data?.error || "Analysis failed");
  return data.analysis;
}

export async function sendAnalysisEmail(params: {
  to: string[];
  subject: string;
  body: string;
  smtpConfig: {
    host: string;
    port: string;
    username: string;
    password: string;
    from: string;
  };
}): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: params,
  });

  if (error) throw new Error(error.message || "Failed to send email");
  if (!data?.success) throw new Error(data?.error || "Email send failed");
  return data;
}

export async function createServiceNowTicket(params: {
  ticket: {
    title: string;
    description: string;
    impact?: string;
    urgency?: string;
    category?: string;
    workNotes?: string;
  };
  serviceNowConfig: {
    instanceUrl: string;
    username: string;
    password: string;
    tableName?: string;
    apiKey?: string;
    authMethod?: string;
  };
}): Promise<{ success: boolean; ticketNumber: string; message: string }> {
  const { data, error } = await supabase.functions.invoke("servicenow-ticket", {
    body: params,
  });

  if (error) throw new Error(error.message || "Failed to create ticket");
  if (!data?.success) throw new Error(data?.error || "Ticket creation failed");
  return data;
}

export async function testAIConnection(params: {
  model: string;
  endpointUrl?: string;
  apiKey?: string;
  timeout?: string;
}): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const { data, error } = await supabase.functions.invoke("test-connection", {
    body: { type: "ai", ...params },
  });

  if (error) throw new Error(error.message || "Connection test failed");
  return data;
}

export async function testServiceNowConnection(params: {
  instanceUrl: string;
  username?: string;
  password?: string;
  apiKey?: string;
  authMethod: string;
}): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke("test-connection", {
    body: { type: "servicenow", ...params },
  });

  if (error) throw new Error(error.message || "Connection test failed");
  return data;
}
