
-- Cache for free-tier Shodan responses
CREATE TABLE IF NOT EXISTS public.shodan_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  query text NOT NULL,
  query_type text NOT NULL,
  source text NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  total integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shodan_cache_key ON public.shodan_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_shodan_cache_expires ON public.shodan_cache(expires_at);

ALTER TABLE public.shodan_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read shodan_cache" ON public.shodan_cache;
CREATE POLICY "Anyone can read shodan_cache" ON public.shodan_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can manage shodan_cache" ON public.shodan_cache;
CREATE POLICY "Anyone can manage shodan_cache" ON public.shodan_cache FOR ALL USING (true) WITH CHECK (true);

-- Extend shodan_queries with last-run telemetry & filters
ALTER TABLE public.shodan_queries
  ADD COLUMN IF NOT EXISTS last_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_source text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS filters jsonb DEFAULT '{}'::jsonb;
