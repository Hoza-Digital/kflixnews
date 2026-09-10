alter table "public"."article_videos" 
add column "description" text default ''::text,
add column "thumbnail_url" text default ''::text;
