alter table public.articles
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists excerpt text,
  add column if not exists content text,
  add column if not exists cover_image_url text,
  add column if not exists cover_image_path text,
  add column if not exists cover_image_alt text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists geo_summary text;

update public.articles
set
  slug = coalesce(
    slug,
    trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')) || '-' || id::text
  ),
  category = coalesce(category, 'Editorial'),
  excerpt = coalesce(
    excerpt,
    'A practical editorial guide to ' || title || ', created for curious STORY readers.'
  ),
  content = coalesce(
    content,
    '<p>This STORY article explores ' || title || ' with useful context, practical ideas, and clear takeaways for readers.</p>'
  ),
  seo_title = coalesce(seo_title, title),
  seo_description = coalesce(
    seo_description,
    'A practical editorial guide to ' || title || ', created for curious STORY readers.'
  ),
  geo_summary = coalesce(
    geo_summary,
    'Editorial: A practical editorial guide to ' || title || ', created for curious STORY readers.'
  )
where slug is null
   or category is null
   or excerpt is null
   or content is null
   or seo_title is null
   or seo_description is null
   or geo_summary is null;

alter table public.articles
  alter column slug set not null,
  alter column category set not null,
  alter column excerpt set not null,
  alter column content set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'articles_slug_format_check'
      and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_slug_format_check
      check (
        char_length(slug) between 1 and 160
        and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'articles_category_length_check'
      and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_category_length_check
      check (char_length(trim(category)) between 2 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'articles_excerpt_length_check'
      and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_excerpt_length_check
      check (char_length(trim(excerpt)) between 20 and 500);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'articles_content_length_check'
      and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_content_length_check
      check (char_length(trim(content)) >= 50);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'articles_cover_alt_length_check'
      and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_cover_alt_length_check
      check (
        cover_image_alt is null
        or char_length(trim(cover_image_alt)) between 3 and 180
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'articles_publication_state_check'
      and conrelid = 'public.articles'::regclass
  ) then
    alter table public.articles
      add constraint articles_publication_state_check
      check (
        (status = 'Published' and published_at is not null and scheduled_for is null)
        or
        (status = 'Draft' and published_at is null)
      );
  end if;
end
$$;

create unique index if not exists articles_slug_key on public.articles (slug);
create index if not exists articles_category_idx on public.articles (category);
create index if not exists articles_scheduled_for_idx
  on public.articles (scheduled_for)
  where scheduled_for is not null;

create table if not exists public.article_images (
  id bigint generated always as identity primary key,
  storage_path text not null unique,
  public_url text not null,
  original_name text not null,
  alt_text text not null check (char_length(trim(alt_text)) between 3 and 180),
  size_bytes bigint not null check (size_bytes between 1 and 1048576),
  width bigint not null check (width > 0),
  height bigint not null check (height > 0),
  mime_type text not null default 'image/webp' check (mime_type = 'image/webp'),
  created_at timestamptz not null default now()
);

alter table public.article_images enable row level security;

drop policy if exists article_images_public_read on public.article_images;
create policy article_images_public_read
on public.article_images for select to anon, authenticated using (true);

drop policy if exists article_images_public_insert on public.article_images;
create policy article_images_public_insert
on public.article_images for insert to anon, authenticated
with check (
  mime_type = 'image/webp'
  and size_bytes between 1 and 1048576
  and char_length(trim(alt_text)) between 3 and 180
);

revoke all on table public.article_images from anon, authenticated;
grant select, insert on table public.article_images to anon, authenticated;
grant usage, select on sequence public.article_images_id_seq to anon, authenticated;

drop policy if exists articles_public_insert_drafts on public.articles;
drop policy if exists articles_public_insert on public.articles;
create policy articles_public_insert
on public.articles for insert to anon, authenticated
with check (
  views = 0
  and status in ('Draft', 'Published')
  and (
    (status = 'Published' and published_at is not null and scheduled_for is null)
    or
    (status = 'Draft' and published_at is null)
  )
);

revoke all on table public.articles from anon, authenticated;
grant select, insert on table public.articles to anon, authenticated;
grant usage, select on sequence public.articles_id_seq to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images', 'article-images', true, 1048576, array['image/webp'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists article_images_public_upload on storage.objects;
create policy article_images_public_upload
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'article-images'
  and lower(storage.extension(name)) = 'webp'
);
