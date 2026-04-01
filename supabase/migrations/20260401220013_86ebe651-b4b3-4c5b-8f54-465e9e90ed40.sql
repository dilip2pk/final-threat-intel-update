
-- Tracker entries table
CREATE TABLE public.tracker_entries (
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

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tracker_entries"
  ON public.tracker_entries FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can manage tracker_entries"
  ON public.tracker_entries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Updated-at trigger
CREATE TRIGGER update_tracker_entries_updated_at
  BEFORE UPDATE ON public.tracker_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default tracker config
INSERT INTO public.app_settings (key, value)
VALUES ('tracker_config', '{
  "storageBucket": "org-assets",
  "storageFolder": "trackers",
  "defaultProductArchitect": "",
  "defaultSupportOwner": "",
  "defaultRndLead": "",
  "dynamicFields": [
    {"key": "deployment_type", "label": "Deployment Type (SaaS/On-Prem/Both)", "type": "select", "options": ["SaaS", "On-Prem", "Both"]},
    {"key": "operating_system", "label": "Operating System", "type": "text"},
    {"key": "service_enabled", "label": "Service Enabled (Yes/No)", "type": "select", "options": ["Yes", "No", "TBC"]},
    {"key": "package_installed", "label": "Package Installed (Yes/No)", "type": "select", "options": ["Yes", "No", "TBC"]},
    {"key": "mitigated", "label": "Mitigated (Patched/Upgraded/Removed)?", "type": "select", "options": ["Yes", "No", "In Progress", "N/A"]},
    {"key": "eta_upgrade", "label": "ETA for Upgrade", "type": "text"},
    {"key": "comments", "label": "Comments", "type": "textarea"}
  ]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
