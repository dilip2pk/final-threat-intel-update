
-- Table for extracted IOCs from RSS feeds
CREATE TABLE public.threat_intel_iocs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ioc_type TEXT NOT NULL DEFAULT 'unknown', -- ip, domain, hash_md5, hash_sha1, hash_sha256, url, cve
  ioc_value TEXT NOT NULL,
  source_feed_id UUID REFERENCES public.feed_sources(id) ON DELETE SET NULL,
  source_feed_name TEXT NOT NULL DEFAULT '',
  source_article_url TEXT DEFAULT '',
  source_article_title TEXT DEFAULT '',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5, -- 0.00 to 1.00
  context TEXT DEFAULT '', -- surrounding text where IOC was found
  tags TEXT[] NOT NULL DEFAULT '{}',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  sighting_count INTEGER NOT NULL DEFAULT 1,
  is_whitelisted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ioc_type, ioc_value)
);

ALTER TABLE public.threat_intel_iocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read threat_intel_iocs" ON public.threat_intel_iocs FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can manage threat_intel_iocs" ON public.threat_intel_iocs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_threat_intel_iocs_type ON public.threat_intel_iocs(ioc_type);
CREATE INDEX idx_threat_intel_iocs_value ON public.threat_intel_iocs(ioc_value);
CREATE INDEX idx_threat_intel_iocs_source ON public.threat_intel_iocs(source_feed_id);

-- Table for AI-analyzed behavioral/contextual intelligence
CREATE TABLE public.threat_intel_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_feed_id UUID REFERENCES public.feed_sources(id) ON DELETE SET NULL,
  source_feed_name TEXT NOT NULL DEFAULT '',
  source_article_url TEXT NOT NULL DEFAULT '',
  source_article_title TEXT NOT NULL DEFAULT '',
  report_type TEXT NOT NULL DEFAULT 'behavioral', -- behavioral, contextual, campaign, ttp
  summary TEXT NOT NULL DEFAULT '',
  threat_actors TEXT[] NOT NULL DEFAULT '{}',
  ttps TEXT[] NOT NULL DEFAULT '{}', -- MITRE ATT&CK TTPs
  affected_sectors TEXT[] NOT NULL DEFAULT '{}',
  affected_products TEXT[] NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'medium',
  ai_model_used TEXT DEFAULT '',
  raw_ai_response TEXT DEFAULT '',
  related_ioc_ids UUID[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_intel_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read threat_intel_reports" ON public.threat_intel_reports FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can manage threat_intel_reports" ON public.threat_intel_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_threat_intel_reports_type ON public.threat_intel_reports(report_type);
CREATE INDEX idx_threat_intel_reports_severity ON public.threat_intel_reports(severity);

-- Processing log to track what's been processed
CREATE TABLE public.threat_intel_processing_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_item_id TEXT NOT NULL, -- RSS item id/link
  feed_source_id UUID REFERENCES public.feed_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  iocs_extracted INTEGER NOT NULL DEFAULT 0,
  has_behavioral_report BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT DEFAULT '',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feed_item_id, feed_source_id)
);

ALTER TABLE public.threat_intel_processing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read threat_intel_processing_log" ON public.threat_intel_processing_log FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can manage threat_intel_processing_log" ON public.threat_intel_processing_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_threat_intel_iocs_updated_at BEFORE UPDATE ON public.threat_intel_iocs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_threat_intel_reports_updated_at BEFORE UPDATE ON public.threat_intel_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
