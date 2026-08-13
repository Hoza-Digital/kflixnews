alter table "public"."users" 
add column "time_format" text not null default '24h'::text;

alter table "public"."site_settings"
drop column "time_format";
