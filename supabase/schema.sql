create extension if not exists "pgcrypto";

create table if not exists public.app_instances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token text not null,
  phone_number text not null default '',
  status text not null default 'created' check (status in ('created', 'connecting', 'open', 'close')),
  qrcode text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_media_assets (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  media_kind text not null check (media_kind in ('image', 'audio', 'video', 'document', 'sticker', 'other')),
  bucket text not null,
  path text not null unique,
  public_url text not null,
  mime_type text,
  size_bytes bigint,
  original_file_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_custom_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_custom_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.app_custom_groups(id) on delete cascade,
  phone_number text not null,
  created_at timestamptz not null default now(),
  unique (group_id, phone_number)
);

alter table public.app_instances enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_media_assets enable row level security;
alter table public.app_custom_groups enable row level security;
alter table public.app_custom_group_members enable row level security;

drop policy if exists app_instances_public_full_access on public.app_instances;
create policy app_instances_public_full_access
on public.app_instances
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists app_settings_public_full_access on public.app_settings;
create policy app_settings_public_full_access
on public.app_settings
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists app_media_assets_public_full_access on public.app_media_assets;
create policy app_media_assets_public_full_access
on public.app_media_assets
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists app_custom_groups_public_full_access on public.app_custom_groups;
create policy app_custom_groups_public_full_access
on public.app_custom_groups
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists app_custom_group_members_public_full_access on public.app_custom_group_members;
create policy app_custom_group_members_public_full_access
on public.app_custom_group_members
for all
to anon, authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('media-assets', 'media-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists media_assets_objects_read on storage.objects;
create policy media_assets_objects_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'media-assets');

drop policy if exists media_assets_objects_insert on storage.objects;
create policy media_assets_objects_insert
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'media-assets');

drop policy if exists media_assets_objects_update on storage.objects;
create policy media_assets_objects_update
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'media-assets')
with check (bucket_id = 'media-assets');

drop policy if exists media_assets_objects_delete on storage.objects;
create policy media_assets_objects_delete
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'media-assets');
