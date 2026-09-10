alter table "public"."site_settings"
add column "time_format" text not null default '24h'::text;

alter table "public"."users"
alter column "time_format" set default 'default'::text;
