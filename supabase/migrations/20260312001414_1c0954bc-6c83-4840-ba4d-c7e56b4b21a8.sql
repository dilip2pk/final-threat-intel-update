
-- AI Prompts table for managing system prompts with versioning
CREATE TABLE public.ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  prompt_key text NOT NULL UNIQUE,
  system_prompt text NOT NULL DEFAULT '',
  user_prompt_template text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT 'all',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Version history table
CREATE TABLE public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  user_prompt_template text NOT NULL DEFAULT '',
  changed_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can read, only admins can modify
CREATE POLICY "Anyone can read ai_prompts" ON public.ai_prompts
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage ai_prompts" ON public.ai_prompts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read ai_prompt_versions" ON public.ai_prompt_versions
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage ai_prompt_versions" ON public.ai_prompt_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default prompts
INSERT INTO public.ai_prompts (name, description, prompt_key, system_prompt, user_prompt_template, provider) VALUES
(
  'Feed Analysis',
  'Analyzes RSS feed items for security threats and vulnerabilities',
  'analyze_feed',
  'You are a cybersecurity threat intelligence analyst. Given an RSS feed item about a security vulnerability, threat, or advisory, produce a structured analysis. Be thorough but concise. For affected versions, only include if relevant (e.g., software vulnerabilities).

IMPORTANT for reference_links:
- ALWAYS include the original source link if provided in the feed item.
- Only include URLs that are real, well-known, and directly relevant (e.g., official CVE pages like cve.mitre.org, NVD entries, vendor advisories).
- Do NOT fabricate or guess URLs. If you are unsure a URL exists, do not include it.
- Prefer specific article/advisory URLs over generic homepages.',
  'Analyze this security feed item:

Title: {{title}}
Source: {{source}}
{{#sourceUrl}}Source URL: {{sourceUrl}}{{/sourceUrl}}
Description: {{description}}
Content: {{content}}

Provide a comprehensive security analysis.',
  'all'
),
(
  'Scan Analysis',
  'Analyzes network scan results for security issues',
  'analyze_scan',
  'You are a cybersecurity analyst specializing in network security assessment. Analyze the provided network scan results and provide actionable security recommendations.',
  'Analyze these network scan results:

Target: {{target}}
Scan Type: {{scanType}}
Results: {{results}}

Provide a comprehensive security assessment.',
  'all'
),
(
  'Command Generation',
  'Generates security tool commands from natural language',
  'generate_command',
  'You are an expert in network security tools. Generate accurate, safe commands for security scanning and analysis tools based on the user request. Always include safety warnings for potentially intrusive scans.',
  '{{userRequest}}',
  'all'
);
