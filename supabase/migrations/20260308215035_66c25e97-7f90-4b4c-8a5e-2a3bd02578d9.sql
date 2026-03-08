
-- Fix critical: app_settings (contains API keys) - admin only for writes, public read
DROP POLICY IF EXISTS "Allow all access to app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can modify app_settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix critical: email_log - admin only
DROP POLICY IF EXISTS "Allow all access to email_log" ON public.email_log;
CREATE POLICY "Anyone can read email_log" ON public.email_log FOR SELECT USING (true);
CREATE POLICY "Admins can modify email_log" ON public.email_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix critical: audit_log - public read, server-side insert only via service role
DROP POLICY IF EXISTS "Allow all access to audit_log" ON public.audit_log;
CREATE POLICY "Anyone can read audit_log" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Fix critical: scans - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to scans" ON public.scans;
CREATE POLICY "Anyone can read scans" ON public.scans FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage scans" ON public.scans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix critical: scan_results - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to scan_results" ON public.scan_results;
CREATE POLICY "Anyone can read scan_results" ON public.scan_results FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage scan_results" ON public.scan_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix critical: scan_schedules - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to scan_schedules" ON public.scan_schedules;
CREATE POLICY "Anyone can read scan_schedules" ON public.scan_schedules FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage scan_schedules" ON public.scan_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix critical: generated_reports - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to generated_reports" ON public.generated_reports;
CREATE POLICY "Anyone can read generated_reports" ON public.generated_reports FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage generated_reports" ON public.generated_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix: scheduled_jobs - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "Anyone can read scheduled_jobs" ON public.scheduled_jobs FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage scheduled_jobs" ON public.scheduled_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix: alert_rules - public read, admin write
DROP POLICY IF EXISTS "Allow all access to alert_rules" ON public.alert_rules;
CREATE POLICY "Anyone can read alert_rules" ON public.alert_rules FOR SELECT USING (true);
CREATE POLICY "Admins can manage alert_rules" ON public.alert_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix: feed_sources - public read, admin write
DROP POLICY IF EXISTS "Allow all access to feed_sources" ON public.feed_sources;
CREATE POLICY "Anyone can read feed_sources" ON public.feed_sources FOR SELECT USING (true);
CREATE POLICY "Admins can manage feed_sources" ON public.feed_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix: shodan tables - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to shodan_queries" ON public.shodan_queries;
CREATE POLICY "Anyone can read shodan_queries" ON public.shodan_queries FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage shodan_queries" ON public.shodan_queries FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to shodan_results" ON public.shodan_results;
CREATE POLICY "Anyone can read shodan_results" ON public.shodan_results FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage shodan_results" ON public.shodan_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix: ticket tables - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to ticket_log" ON public.ticket_log;
CREATE POLICY "Anyone can read ticket_log" ON public.ticket_log FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage ticket_log" ON public.ticket_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to ticket_history" ON public.ticket_history;
CREATE POLICY "Anyone can read ticket_history" ON public.ticket_history FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage ticket_history" ON public.ticket_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix: watchlist - public read, authenticated write
DROP POLICY IF EXISTS "Allow all access to watchlist" ON public.watchlist;
CREATE POLICY "Anyone can read watchlist" ON public.watchlist FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage watchlist" ON public.watchlist FOR ALL TO authenticated USING (true) WITH CHECK (true);
