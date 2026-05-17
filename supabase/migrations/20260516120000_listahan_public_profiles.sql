-- Public profile rows keyed by a random UUID stored on the device (for future sync / discovery).
-- Avatar files live in public bucket `profile_avatars` at `{device_profile_id}/avatar.jpg`.
-- Run after enabling Storage in the Supabase project.
--
-- App env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

create table if not exists public.listahan_public_profiles (
  device_profile_id uuid primary key,
  display_name text not null default '',
  avatar_storage_path text,
  updated_at timestamptz not null default now()
);

alter table public.listahan_public_profiles enable row level security;

-- Direct table access disabled for anon; use SECURITY DEFINER RPCs.

create or replace function public.upsert_listahan_public_profile(
  p_device_profile_id uuid,
  p_display_name text,
  p_avatar_storage_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := trim(coalesce(p_display_name, ''));
  if length(v_name) > 80 then
    raise exception 'display_name too long';
  end if;
  if p_avatar_storage_path is not null and length(p_avatar_storage_path) > 512 then
    raise exception 'avatar path too long';
  end if;

  insert into public.listahan_public_profiles (
    device_profile_id,
    display_name,
    avatar_storage_path,
    updated_at
  )
  values (
    p_device_profile_id,
    v_name,
    p_avatar_storage_path,
    now()
  )
  on conflict (device_profile_id) do update set
    display_name = case
      when length(trim(coalesce(excluded.display_name, ''))) > 0 then excluded.display_name
      else listahan_public_profiles.display_name
    end,
    avatar_storage_path = excluded.avatar_storage_path,
    updated_at = now();
end;
$$;

grant execute on function public.upsert_listahan_public_profile(uuid, text, text) to anon, authenticated;

create or replace function public.get_listahan_public_profile(p_device_profile_id uuid)
returns table (
  display_name text,
  avatar_storage_path text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.display_name, p.avatar_storage_path, p.updated_at
  from public.listahan_public_profiles p
  where p.device_profile_id = p_device_profile_id;
$$;

grant execute on function public.get_listahan_public_profile(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('profile_avatars', 'profile_avatars', true)
on conflict (id) do nothing;

create policy "Public read profile avatars"
on storage.objects for select
to public
using (bucket_id = 'profile_avatars');

create policy "Anon insert profile avatars"
on storage.objects for insert
to anon
with check (
  bucket_id = 'profile_avatars'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.(jpg|jpeg|png)$'
);

create policy "Anon update profile avatars"
on storage.objects for update
to anon
using (bucket_id = 'profile_avatars')
with check (
  bucket_id = 'profile_avatars'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.(jpg|jpeg|png)$'
);

create policy "Anon delete profile avatars"
on storage.objects for delete
to anon
using (
  bucket_id = 'profile_avatars'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.(jpg|jpeg|png)$'
);
