
-- Feed sources table (persist RSS feed configs)
CREATE TABLE public.feed_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  category text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  last_fetched timestamptz,
  total_items integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to feed_sources" ON public.feed_sources FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_feed_sources_updated_at BEFORE UPDATE ON public.feed_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email log table (track sent emails)
CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipients text[] NOT NULL,
  subject text NOT NULL,
  body text,
  related_feed_id text,
  related_feed_title text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to email_log" ON public.email_log FOR ALL USING (true) WITH CHECK (true);

-- Ticket log table (track ServiceNow tickets)
CREATE TABLE public.ticket_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Open',
  priority text NOT NULL DEFAULT 'Medium',
  assigned_to text,
  category text,
  resolution_notes text,
  related_feed_id text,
  related_feed_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to ticket_log" ON public.ticket_log FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_ticket_log_updated_at BEFORE UPDATE ON public.ticket_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticket timeline / history
CREATE TABLE public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.ticket_log(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  old_value text,
  new_value text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to ticket_history" ON public.ticket_history FOR ALL USING (true) WITH CHECK (true);

-- Shodan saved queries
CREATE TABLE public.shodan_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  query text NOT NULL,
  query_type text NOT NULL DEFAULT 'search',
  is_dork boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shodan_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to shodan_queries" ON public.shodan_queries FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_shodan_queries_updated_at BEFORE UPDATE ON public.shodan_queries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shodan results cache
CREATE TABLE public.shodan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES public.shodan_queries(id) ON DELETE CASCADE NOT NULL,
  result_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shodan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to shodan_results" ON public.shodan_results FOR ALL USING (true) WITH CHECK (true);

-- Audit log (track all sensitive actions)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}',
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for ticket_log so we can show live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_log;
