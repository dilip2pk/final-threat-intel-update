CREATE TABLE public.scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  job_type text NOT NULL DEFAULT 'shodan_scan',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  frequency text NOT NULL DEFAULT 'once',
  cron_expression text DEFAULT '',
  active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to scheduled_jobs" ON public.scheduled_jobs FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_scheduled_jobs_updated_at BEFORE UPDATE ON public.scheduled_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();