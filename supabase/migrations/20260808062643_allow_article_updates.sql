grant update on table public.articles to anon, authenticated;

drop policy if exists articles_public_update on public.articles;
create policy articles_public_update
on public.articles for update to anon, authenticated
using (true)
with check (
  char_length(trim(title)) between 3 and 240
  and char_length(trim(author)) between 1 and 120
  and char_length(trim(editor)) between 1 and 120
  and char_length(trim(category)) between 2 and 80
  and char_length(trim(excerpt)) between 20 and 500
  and char_length(trim(content)) >= 50
  and views >= 0
  and status in ('Draft', 'Published')
  and (
    (status = 'Published' and published_at is not null and scheduled_for is null)
    or
    (status = 'Draft' and published_at is null)
  )
);
