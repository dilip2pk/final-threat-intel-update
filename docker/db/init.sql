-- =============================================================
-- ThreatIntel — Database Schema Initialization
-- =============================================================
-- This runs on first container startup to create the full schema.
-- =============================================================

-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- Profiles ----
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- User Roles ----
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ---- App Settings ----
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Feed Sources ----
CREATE TABLE IF NOT EXISTS public.feed_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  last_fetched TIMESTAMPTZ,
  total_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Alert Rules ----
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  severity_threshold TEXT NOT NULL DEFAULT 'high',
  url_pattern TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Scans ----
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'ip',
  scan_type TEXT NOT NULL DEFAULT 'quick',
  ports TEXT DEFAULT '',
  timing_template TEXT DEFAULT 'T3',
  enable_scripts BOOLEAN DEFAULT false,
  custom_options TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by TEXT DEFAULT 'system',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_summary JSONB DEFAULT '{}',
  ai_analysis JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Scan Results ----
CREATE TABLE IF NOT EXISTS public.scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  host_status TEXT DEFAULT 'up',
  os_detection TEXT,
  ports JSONB DEFAULT '[]',
  vulnerabilities JSONB DEFAULT '[]',
  raw_output TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Scan Schedules ----
CREATE TABLE IF NOT EXISTS public.scan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'ip',
  scan_type TEXT NOT NULL DEFAULT 'quick',
  ports TEXT DEFAULT '',
  timing_template TEXT DEFAULT 'T3',
  enable_scripts BOOLEAN DEFAULT false,
  custom_options TEXT DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'once',
  cron_expression TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  auto_ai_analysis BOOLEAN DEFAULT true,
  auto_ticket BOOLEAN DEFAULT false,
  notify_email BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Shodan Queries ----
CREATE TABLE IF NOT EXISTS public.shodan_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  query_type TEXT NOT NULL DEFAULT 'search',
  is_dork BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Shodan Results ----
CREATE TABLE IF NOT EXISTS public.shodan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.shodan_queries(id) ON DELETE CASCADE,
  result_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Generated Reports ----
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scan_id UUID REFERENCES public.scans(id),
  scan_target TEXT,
  scan_type TEXT,
  format TEXT NOT NULL DEFAULT 'html',
  report_url TEXT,
  report_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Audit Log ----
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  actor TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Email Log ----
CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  recipients TEXT[] NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  related_feed_id TEXT,
  related_feed_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Ticket Log ----
CREATE TABLE IF NOT EXISTS public.ticket_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  priority TEXT NOT NULL DEFAULT 'Medium',
  assigned_to TEXT,
  category TEXT,
  related_feed_id TEXT,
  related_feed_title TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Ticket History ----
CREATE TABLE IF NOT EXISTS public.ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.ticket_log(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Top CVEs ----
CREATE TABLE IF NOT EXISTS public.top_cves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'high',
  source_url TEXT DEFAULT '',
  published_date TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Watchlist ----
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  notify_method TEXT NOT NULL DEFAULT 'email',
  notify_frequency TEXT NOT NULL DEFAULT 'instant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Scheduled Jobs ----
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'shodan_scan',
  frequency TEXT NOT NULL DEFAULT 'once',
  cron_expression TEXT DEFAULT '',
  configuration JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status TEXT DEFAULT 'pending',
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- AI Prompts ----
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'builtin',
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt_template TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- AI Prompt Versions ----
CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt_template TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Tracker Entries ----
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_title TEXT NOT NULL,
  feed_link TEXT DEFAULT '',
  feed_source TEXT DEFAULT '',
  severity TEXT DEFAULT 'medium',
  cve_id TEXT DEFAULT '',
  product_name TEXT NOT NULL,
  product_architect TEXT DEFAULT '',
  support_owner TEXT DEFAULT '',
  rnd_lead TEXT DEFAULT '',
  deployment_type TEXT DEFAULT '',
  operating_system TEXT DEFAULT '',
  service_enabled TEXT DEFAULT '',
  package_installed TEXT DEFAULT '',
  mitigated TEXT DEFAULT 'No',
  eta_upgrade TEXT DEFAULT '',
  comments TEXT DEFAULT '',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Helper Functions ----
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ---- Updated-at Triggers ----
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'app_settings','feed_sources','alert_rules','scans',
    'scan_schedules','shodan_queries','ticket_log','top_cves',
    'scheduled_jobs','ai_prompts','tracker_entries'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I; 
       CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I 
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;

-- ---- PostgREST Roles (for standalone PostgreSQL without Supabase) ----
-- These roles are required for PostgREST to work. Supabase creates them
-- automatically, but standalone PostgreSQL needs them explicitly.
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticator LOGIN PASSWORD 'changeme';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

-- Grant access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Seed default settings
INSERT INTO public.app_settings (key, value)
VALUES ('general', '{"appName": "ThreatIntel", "logoUrl": "", "sidebarIconUrl": "", "fetchInterval": "*/5 * * * *", "severityThreshold": "critical", "duplicateDetection": true, "emailEnabled": false, "notifyProvider": "email", "webhookUrl": "", "alertTemplate": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('integrations', '{"smtp": {"host": "", "port": "587", "username": "", "password": "", "from": ""}, "serviceNow": {"instanceUrl": "", "username": "", "password": "", "tableName": "incident", "apiKey": "", "authMethod": "basic", "fieldMapping": {"title": "short_description", "description": "description", "priority": "priority", "category": "category"}}, "ai": {"model": "google/gemini-3-flash-preview", "apiKey": "", "endpointUrl": "", "maxTokens": "4096", "timeout": "30", "temperature": "0.3", "apiType": "builtin", "authHeaderType": "bearer"}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Done!
SELECT 'ThreatIntel database initialized successfully' AS status;
