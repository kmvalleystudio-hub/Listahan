-- Replace display_name with unique username (case-insensitive via stored lowercase).
-- Run in Supabase SQL editor after prior listahan_public_profiles migrations.

alter table public.listahan_public_profiles add column if not exists username text not null default '';

create unique index if not exists listahan_public_profiles_username_lower_uq
  on public.listahan_public_profiles (lower(trim(username)))
  where length(trim(username)) >= 3;

drop function if exists public.check_listahan_username_available(text, uuid);

create or replace function public.check_listahan_username_available(
  p_username text,
  p_device_profile_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.listahan_public_profiles o
    where length(trim(o.username)) >= 3
      and lower(trim(o.username)) = lower(trim(p_username))
      and o.device_profile_id <> p_device_profile_id
  );
$$;

grant execute on function public.check_listahan_username_available(text, uuid) to anon, authenticated;

comment on column public.listahan_public_profiles.username is
  'Unique handle for discovery/sync (lowercase a-z, 0-9, underscore; 3–30 chars).';

-- Replace upsert: third argument is avatar path (unchanged).
drop function if exists public.upsert_listahan_public_profile(uuid, text, text);

create or replace function public.upsert_listahan_public_profile(
  p_device_profile_id uuid,
  p_username text,
  p_avatar_storage_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text;
begin
  v_user := lower(trim(coalesce(p_username, '')));
  if length(v_user) < 3 or length(v_user) > 30 then
    raise exception 'username_invalid_length';
  end if;
  if v_user !~ '^[a-z0-9][a-z0-9_]{2,29}$' then
    raise exception 'username_invalid_chars';
  end if;

  if exists (
    select 1 from public.listahan_public_profiles o
    where length(trim(o.username)) >= 3
      and lower(trim(o.username)) = v_user
      and o.device_profile_id <> p_device_profile_id
  ) then
    raise exception 'username_taken';
  end if;

  if p_avatar_storage_path is not null and length(p_avatar_storage_path) > 512 then
    raise exception 'avatar path too long';
  end if;

  insert into public.listahan_public_profiles (
    device_profile_id,
    username,
    avatar_storage_path,
    updated_at
  )
  values (
    p_device_profile_id,
    v_user,
    p_avatar_storage_path,
    now()
  )
  on conflict (device_profile_id) do update set
    username = excluded.username,
    avatar_storage_path = excluded.avatar_storage_path,
    updated_at = now();
end;
$$;

grant execute on function public.upsert_listahan_public_profile(uuid, text, text) to anon, authenticated;

drop function if exists public.get_listahan_public_profile(uuid);

create or replace function public.get_listahan_public_profile(p_device_profile_id uuid)
returns table (
  user_id uuid,
  username text,
  avatar_storage_path text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.device_profile_id as user_id,
    p.username,
    p.avatar_storage_path,
    p.updated_at
  from public.listahan_public_profiles p
  where p.device_profile_id = p_device_profile_id;
$$;

grant execute on function public.get_listahan_public_profile(uuid) to anon, authenticated;

alter table public.listahan_public_profiles drop column if exists display_name;
