-- nihaalnazeer.com content store.
-- Paste this whole file into Supabase > SQL Editor > New query and press Run. It is safe to run again.
--
-- Shapes mirror lib/cms/types.ts; lib/cms/rows.ts maps these snake_case columns to the camelCase types.
-- The slug pattern, upload size limit and allowed file types are repeated in lib/cms/defaults.ts.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                constraint projects_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null default '',
  category      text not null default 'brand'
                constraint projects_category_valid check (category in ('brand', 'spatial', 'interface', 'print')),
  year          integer not null default extract(year from now())::integer,
  discipline    text not null default '',
  summary       text not null default '',
  cover         jsonb,
  accent        text not null default '#6FF3FF',
  role          text not null default '',
  project_type  text not null default ''
                constraint projects_project_type_valid check (project_type in ('client', 'uni', 'self', '')),
  tools         text not null default '',
  deliverables  text not null default '',
  link          text not null default '',
  featured      boolean not null default false,
  position      integer not null default 0,
  status        text not null default 'draft'
                constraint projects_status_valid check (status in ('draft', 'published')),
  blocks        jsonb not null default '[]'::jsonb
                constraint projects_blocks_is_array check (jsonb_typeof(blocks) = 'array'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);

create index if not exists projects_status_position_idx on public.projects (status, position);

-- One row only (id = 1): the whole Settings object, minus updatedAt, as JSON.
create table if not exists public.settings (
  id          integer primary key constraint settings_single_row check (id = 1),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Who may edit. Add yourself with the statement at the end of this file.
create table if not exists public.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------------------------

-- Keeps updated_at current, and stamps published_at the first time a project is published (it is kept after that).
create or replace function public.projects_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.created_at := old.created_at;
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists projects_before_write on public.projects;
create trigger projects_before_write
  before insert or update on public.projects
  for each row execute function public.projects_before_write();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------

-- True when the signed-in user is listed in public.admins. Security definer so policies can call it
-- without depending on the admins table's own policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Sets position = index in `ids` for each listed project, in one statement. Runs as the caller, so RLS decides
-- whether they may update projects at all.
create or replace function public.reorder_projects(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.projects as p
     set position = o.ord - 1
    from unnest(ids) with ordinality as o(id, ord)
   where p.id = o.id
     and p.position is distinct from (o.ord - 1)::integer;
$$;

revoke execute on function public.reorder_projects(uuid[]) from public, anon;
grant execute on function public.reorder_projects(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.settings enable row level security;
alter table public.admins enable row level security;

-- projects: everyone sees published work; admins see and change everything.
drop policy if exists "Published projects are public" on public.projects;
create policy "Published projects are public"
  on public.projects for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Admins manage projects" on public.projects;
create policy "Admins manage projects"
  on public.projects for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- settings: everyone reads; admins write.
drop policy if exists "Settings are public" on public.settings;
create policy "Settings are public"
  on public.settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage settings" on public.settings;
create policy "Admins manage settings"
  on public.settings for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- admins: a user can see only their own row, which is how the site checks "am I an admin?".
-- There are no insert, update or delete policies, so the list can only be changed from the SQL editor.
drop policy if exists "Admins can see their own row" on public.admins;
create policy "Admins can see their own row"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Spelled out so the API roles have table access even on projects that do not grant it by default.
-- RLS above still decides which rows each role can touch.
grant select on public.projects, public.settings to anon, authenticated;
grant insert, update, delete on public.projects, public.settings to authenticated;
grant select on public.admins to authenticated;
revoke all on public.admins from anon;

-- ---------------------------------------------------------------------------------------------------------------
-- Storage: one public bucket, 'media', for every uploaded image, film and PDF
-- ---------------------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800, -- 50 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

-- The bucket is public, so anyone can open a file from its URL with no policy at all. A select policy would also let
-- them list the bucket, which gives away draft projects' folders and files, so only admins get one (removing an
-- upload needs it too). Earlier copies of this file let everyone list; running this again drops that policy.
drop policy if exists "Media is public" on storage.objects;
drop policy if exists "Admins read media" on storage.objects;
create policy "Admins read media"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admins upload media" on storage.objects;
create policy "Admins upload media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admins update media" on storage.objects;
create policy "Admins update media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admins delete media" on storage.objects;
create policy "Admins delete media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

-- ---------------------------------------------------------------------------------------------------------------
-- Make yourself an admin
-- ---------------------------------------------------------------------------------------------------------------
-- 1. Authentication > Users > Add user > Create new user: your email and a strong password, "Auto Confirm User" on.
-- 2. Authentication > Sign In / Providers: turn off "Allow new users to sign up", so nobody else can make an account.
-- 3. Run this in a new query, with your email in place of the example:
--
--      insert into public.admins (user_id)
--      select id from auth.users where email = 'you@example.com'
--      on conflict do nothing;
--
-- To remove someone later:  delete from public.admins where user_id = (select id from auth.users where email = '...');
