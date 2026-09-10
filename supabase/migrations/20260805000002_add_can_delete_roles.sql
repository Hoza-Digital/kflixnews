-- Add can_delete_roles column to roles table
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_delete_roles text[] DEFAULT '{}'::text[];

-- Update default roles to give Admin the ability to delete roles (optional, but good for UX)
-- Admin can delete Admin and Editor
UPDATE public.roles 
SET can_delete_roles = ARRAY['Admin', 'Editor']
WHERE name = 'Admin';
