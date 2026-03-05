
CREATE TABLE public.top_cves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  severity text NOT NULL DEFAULT 'high',
  source_url text DEFAULT '',
  published_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.top_cves ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can view top_cves" ON public.top_cves
  FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage top_cves" ON public.top_cves
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
