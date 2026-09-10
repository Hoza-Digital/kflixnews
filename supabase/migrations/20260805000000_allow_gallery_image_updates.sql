-- Grant UPDATE and DELETE privileges on the table
grant update, delete on table public.article_images to anon, authenticated;

-- Add RLS policy for UPDATE on the table
drop policy if exists article_images_public_update on public.article_images;
create policy article_images_public_update
on public.article_images for update to anon, authenticated
using (true)
with check (
  char_length(trim(alt_text)) between 3 and 180
);

-- Add RLS policy for DELETE on the table
drop policy if exists article_images_public_delete on public.article_images;
create policy article_images_public_delete
on public.article_images for delete to anon, authenticated
using (true);

-- Add RLS policy for DELETE on storage objects
drop policy if exists article_images_storage_public_delete on storage.objects;
create policy article_images_storage_public_delete
on storage.objects for delete to anon, authenticated
using (bucket_id = 'article-images');
