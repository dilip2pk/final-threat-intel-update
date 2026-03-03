
-- Scans table
CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'ip', -- ip, domain, cidr, multiple
  scan_type TEXT NOT NULL DEFAULT 'quick', -- quick, full, service, os, vuln, custom
  ports TEXT DEFAULT '',
  timing_template TEXT DEFAULT 'T3',
  enable_scripts BOOLEAN DEFAULT false,
  custom_options TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  initiated_by TEXT DEFAULT 'system',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result_summary JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scans" ON public.scans FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_scans_updated_at
  BEFORE UPDATE ON public.scans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Scan results (per-host findings)
CREATE TABLE public.scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  host_status TEXT DEFAULT 'up',
  os_detection TEXT,
  ports JSONB DEFAULT '[]'::jsonb, -- [{port, protocol, state, service, version, scripts}]
  vulnerabilities JSONB DEFAULT '[]'::jsonb,
  raw_output TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scan_results" ON public.scan_results FOR ALL USING (true) WITH CHECK (true);

-- Scan schedules
CREATE TABLE public.scan_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  target TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'ip',
  scan_type TEXT NOT NULL DEFAULT 'quick',
  ports TEXT DEFAULT '',
  timing_template TEXT DEFAULT 'T3',
  enable_scripts BOOLEAN DEFAULT false,
  custom_options TEXT DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'once', -- once, daily, weekly, monthly, custom
  cron_expression TEXT DEFAULT '',
  notify_email BOOLEAN DEFAULT false,
  auto_ticket BOOLEAN DEFAULT false,
  auto_ai_analysis BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scan_schedules" ON public.scan_schedules FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_scan_schedules_updated_at
  BEFORE UPDATE ON public.scan_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for scans to show live status
ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;
