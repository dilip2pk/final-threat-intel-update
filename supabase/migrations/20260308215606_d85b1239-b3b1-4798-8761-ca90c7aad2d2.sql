
-- Allow public (anon) users to manage scans
DROP POLICY IF EXISTS "Authenticated can manage scans" ON public.scans;
CREATE POLICY "Anyone can manage scans" ON public.scans FOR ALL USING (true) WITH CHECK (true);

-- Allow public users to manage scan_results
DROP POLICY IF EXISTS "Authenticated can manage scan_results" ON public.scan_results;
CREATE POLICY "Anyone can manage scan_results" ON public.scan_results FOR ALL USING (true) WITH CHECK (true);

-- Allow public users to manage scan_schedules
DROP POLICY IF EXISTS "Authenticated can manage scan_schedules" ON public.scan_schedules;
CREATE POLICY "Anyone can manage scan_schedules" ON public.scan_schedules FOR ALL USING (true) WITH CHECK (true);

-- Allow public users to manage scheduled_jobs
DROP POLICY IF EXISTS "Authenticated can manage scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "Anyone can manage scheduled_jobs" ON public.scheduled_jobs FOR ALL USING (true) WITH CHECK (true);

-- Allow public users to manage shodan_queries
DROP POLICY IF EXISTS "Authenticated can manage shodan_queries" ON public.shodan_queries;
CREATE POLICY "Anyone can manage shodan_queries" ON public.shodan_queries FOR ALL USING (true) WITH CHECK (true);

-- Allow public users to manage shodan_results
DROP POLICY IF EXISTS "Authenticated can manage shodan_results" ON public.shodan_results;
CREATE POLICY "Anyone can manage shodan_results" ON public.shodan_results FOR ALL USING (true) WITH CHECK (true);

-- Allow public users to manage generated_reports
DROP POLICY IF EXISTS "Authenticated can manage generated_reports" ON public.generated_reports;
CREATE POLICY "Anyone can manage generated_reports" ON public.generated_reports FOR ALL USING (true) WITH CHECK (true);
