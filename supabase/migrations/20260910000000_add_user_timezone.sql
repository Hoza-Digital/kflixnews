-- Keep fresh databases aligned with the user profile type and settings form.
alter table public.users
  add column if not exists timezone text not null default 'default';
