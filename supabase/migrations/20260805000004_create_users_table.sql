CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  profile_photo_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (since we're mocking auth)
CREATE POLICY "Enable all for public users" ON public.users
  FOR ALL
  USING (true)
  WITH CHECK (true);
