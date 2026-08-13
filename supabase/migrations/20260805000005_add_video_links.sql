create table if not exists public.article_videos (
  id bigint generated always as identity primary key,
  title text not null check (char_length(trim(title)) between 3 and 180),
  video_url text not null,
  created_at timestamptz not null default now()
);

alter table public.article_videos enable row level security;

create policy article_videos_public_read
on public.article_videos for select to anon, authenticated using (true);

create policy article_videos_public_insert
on public.article_videos for insert to anon, authenticated
with check (
  char_length(trim(title)) between 3 and 180
);

create policy article_videos_public_update
on public.article_videos for update to anon, authenticated
using (true)
with check (
  char_length(trim(title)) between 3 and 180
);

create policy article_videos_public_delete
on public.article_videos for delete to anon, authenticated
using (true);

revoke all on table public.article_videos from anon, authenticated;
grant select, insert, update, delete on table public.article_videos to anon, authenticated;
grant usage, select on sequence public.article_videos_id_seq to anon, authenticated;