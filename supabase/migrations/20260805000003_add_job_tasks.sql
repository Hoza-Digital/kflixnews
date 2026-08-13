-- Add job_tasks column to roles table
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS job_tasks text[] DEFAULT '{}'::text[];

-- Give the Admin role all default tasks
UPDATE public.roles 
SET job_tasks = ARRAY['Create Article', 'Edit Article', 'Delete Article', 'Publish Article', 'Upload Photo', 'Delete Photo', 'Manage Comments']
WHERE name = 'Admin';
