-- What the images show ("In the images" in a case file), and whether a spatial project is shown by stills only
-- (so its case file doesn't ask for a headset capture). Mirrored in d1/migrations/0001_init.sql.

alter table public.projects add column if not exists shown text not null default '';
alter table public.projects add column if not exists still_only boolean not null default false;
