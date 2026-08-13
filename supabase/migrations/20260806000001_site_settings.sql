create table "public"."site_settings" (
    "id" integer not null default 1,
    "timezone" text not null default 'UTC'::text,
    "time_format" text not null default '24h'::text,
    "updated_at" timestamp with time zone not null default now(),
    constraint "site_settings_pkey" primary key ("id"),
    constraint "site_settings_id_check" check (id = 1)
);

insert into "public"."site_settings" ("id", "timezone", "time_format") 
values (1, 'UTC', '24h')
on conflict ("id") do nothing;
