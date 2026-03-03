
-- App settings table (single-tenant key-value store)
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Alert rules table
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  severity_threshold TEXT NOT NULL DEFAULT 'high',
  url_pattern TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Watchlist table
CREATE TABLE public.watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization TEXT NOT NULL,
  notify_method TEXT NOT NULL DEFAULT 'email',
  notify_frequency TEXT NOT NULL DEFAULT 'instant',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organization logo storage
INSERT INTO storage.buckets (id, name, public) VALUES ('org-assets', 'org-assets', true);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- Since this is a single-tenant app without auth currently, allow all access
-- These can be tightened later when auth is added
CREATE POLICY "Allow all access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to alert_rules" ON public.alert_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to watchlist" ON public.watchlist FOR ALL USING (true) WITH CHECK (true);

-- Storage policies for org-assets
CREATE POLICY "Public read org-assets" ON storage.objects FOR SELECT USING (bucket_id = 'org-assets');
CREATE POLICY "Allow upload org-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'org-assets');
CREATE POLICY "Allow update org-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'org-assets');
CREATE POLICY "Allow delete org-assets" ON storage.objects FOR DELETE USING (bucket_id = 'org-assets');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
