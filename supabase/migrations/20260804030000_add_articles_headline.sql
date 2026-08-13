alter table public.articles
  add column if not exists is_headline boolean not null default false;

create index if not exists articles_headline_created_at_idx
  on public.articles (created_at desc)
  where is_headline = true;
