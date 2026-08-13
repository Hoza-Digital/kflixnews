CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  can_see_pages text[] DEFAULT '{}'::text[],
  can_create_roles text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone (so the UI can fetch roles)
CREATE POLICY "Enable read access for all users" ON public.roles
  FOR SELECT USING (true);

-- Allow insert/update access to anyone for now (since there is no real auth yet)
CREATE POLICY "Enable insert for all users" ON public.roles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.roles
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.roles
  FOR DELETE USING (true);

-- Insert default roles
INSERT INTO public.roles (name, can_see_pages, can_create_roles)
VALUES 
  ('Admin', ARRAY['Dashboard', 'New Article', 'Articles', 'Photo Gallery', 'Comments', 'Settings'], ARRAY[]::text[]),
  ('Editor', ARRAY['Dashboard', 'New Article', 'Articles', 'Photo Gallery'], ARRAY[]::text[])
ON CONFLICT (name) DO NOTHING;
