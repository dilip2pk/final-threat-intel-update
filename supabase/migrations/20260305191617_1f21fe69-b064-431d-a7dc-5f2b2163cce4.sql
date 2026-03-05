CREATE TABLE public.generated_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'html',
  report_url TEXT,
  report_html TEXT,
  scan_target TEXT,
  scan_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to generated_reports" ON public.generated_reports FOR ALL USING (true) WITH CHECK (true);