
-- Threat Hunts table
CREATE TABLE public.threat_hunts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  query JSONB NOT NULL DEFAULT '{}',
  hunt_type TEXT NOT NULL DEFAULT 'query',
  status TEXT NOT NULL DEFAULT 'draft',
  severity TEXT NOT NULL DEFAULT 'medium',
  findings_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_hunts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read threat_hunts" ON public.threat_hunts
  FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated can manage threat_hunts" ON public.threat_hunts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_threat_hunts_updated_at
  BEFORE UPDATE ON public.threat_hunts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Threat Hunt Results table
CREATE TABLE public.threat_hunt_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hunt_id UUID NOT NULL REFERENCES public.threat_hunts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'feed',
  source_id TEXT,
  match_data JSONB NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_false_positive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_hunt_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read threat_hunt_results" ON public.threat_hunt_results
  FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated can manage threat_hunt_results" ON public.threat_hunt_results
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_threat_hunt_results_hunt_id ON public.threat_hunt_results(hunt_id);

-- Threat Hunt Playbooks table
CREATE TABLE public.threat_hunt_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  steps JSONB NOT NULL DEFAULT '[]',
  severity TEXT NOT NULL DEFAULT 'medium',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_hunt_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read threat_hunt_playbooks" ON public.threat_hunt_playbooks
  FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated can manage threat_hunt_playbooks" ON public.threat_hunt_playbooks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_threat_hunt_playbooks_updated_at
  BEFORE UPDATE ON public.threat_hunt_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
