create table public.articles (
  id bigint generated always as identity primary key,
  title text not null,
  author text not null,
  editor text not null default 'Unassigned',
  status text not null default 'Draft',
  published_at timestamptz,
  views bigint not null default 0,
  image_style text not null default 'linear-gradient(135deg, #dbe8ff, #f2f6ff 52%, #7c9cf5 53%)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_title_length check (char_length(trim(title)) between 3 and 240),
  constraint articles_author_length check (char_length(trim(author)) between 1 and 120),
  constraint articles_editor_length check (char_length(trim(editor)) between 1 and 120),
  constraint articles_status_allowed check (status in ('Draft', 'Published')),
  constraint articles_views_nonnegative check (views >= 0),
  constraint articles_published_date check (status = 'Draft' or published_at is not null)
);

create index articles_created_at_idx on public.articles (created_at desc);
create index articles_status_created_at_idx on public.articles (status, created_at desc);

alter table public.articles enable row level security;

revoke all on table public.articles from anon, authenticated;
grant select, insert on table public.articles to anon, authenticated;
grant select, insert, update, delete on table public.articles to service_role;

revoke all on sequence public.articles_id_seq from anon, authenticated;
grant usage, select on sequence public.articles_id_seq to anon, authenticated;
grant usage, select, update on sequence public.articles_id_seq to service_role;

create policy "articles_public_read"
  on public.articles for select to anon, authenticated using (true);

create policy "articles_public_create_draft"
  on public.articles for insert to anon, authenticated
  with check (
    status = 'Draft'
    and editor = 'Unassigned'
    and views = 0
    and published_at is null
  );

create table public.traffic_daily (
  day date primary key,
  page_views bigint not null,
  created_at timestamptz not null default now(),
  constraint traffic_daily_views_nonnegative check (page_views >= 0)
);

create index traffic_daily_day_desc_idx on public.traffic_daily (day desc);

alter table public.traffic_daily enable row level security;

revoke all on table public.traffic_daily from anon, authenticated;
grant select on table public.traffic_daily to anon, authenticated;
grant select, insert, update, delete on table public.traffic_daily to service_role;

create policy "traffic_daily_public_read"
  on public.traffic_daily for select to anon, authenticated using (true);
