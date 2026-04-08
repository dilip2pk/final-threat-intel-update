
-- Persistent cache for RSS feed items
CREATE TABLE public.feed_items_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_source_id UUID REFERENCES public.feed_sources(id) ON DELETE CASCADE,
  feed_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  pub_date TIMESTAMP WITH TIME ZONE,
  category TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feed_source_id, link)
);

-- Index for fast date-based queries
CREATE INDEX idx_feed_items_cache_pub_date ON public.feed_items_cache(pub_date DESC);
CREATE INDEX idx_feed_items_cache_feed_source ON public.feed_items_cache(feed_source_id);
CREATE INDEX idx_feed_items_cache_title_search ON public.feed_items_cache USING gin(to_tsvector('english', title));

-- Enable RLS
ALTER TABLE public.feed_items_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Anyone can read feed_items_cache"
  ON public.feed_items_cache FOR SELECT TO public
  USING (true);

-- Service role inserts via edge functions (anon/authenticated for flexibility)
CREATE POLICY "Anyone can insert feed_items_cache"
  ON public.feed_items_cache FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update feed_items_cache"
  ON public.feed_items_cache FOR UPDATE TO public
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_feed_items_cache_updated_at
  BEFORE UPDATE ON public.feed_items_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
