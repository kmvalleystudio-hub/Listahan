-- 4-character suffix on public Listahan tags (e.g. @john_x7k2).

alter table public.listahan_public_profiles
  add column if not exists tag_suffix text not null default '';

comment on column public.listahan_public_profiles.tag_suffix is
  'Four lowercase alphanumeric chars appended to the username in the public tag.';

drop function if exists public.upsert_listahan_public_profile(uuid, text, text);

create or replace function public.upsert_listahan_public_profile(
  p_device_profile_id uuid,
  p_username text,
  p_avatar_storage_path text,
  p_tag_suffix text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text;
  v_suffix text;
begin
  v_user := lower(trim(coalesce(p_username, '')));
  if length(v_user) < 3 or length(v_user) > 30 then
    raise exception 'username_invalid_length';
  end if;
  if v_user !~ '^[a-z0-9][a-z0-9_]{2,29}$' then
    raise exception 'username_invalid_chars';
  end if;

  v_suffix := lower(trim(coalesce(p_tag_suffix, '')));
  if length(v_suffix) > 0 and v_suffix !~ '^[a-z0-9]{4}$' then
    raise exception 'tag_suffix_invalid';
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
    tag_suffix,
    avatar_storage_path,
    updated_at
  )
  values (
    p_device_profile_id,
    v_user,
    v_suffix,
    p_avatar_storage_path,
    now()
  )
  on conflict (device_profile_id) do update set
    username = excluded.username,
    tag_suffix = case
      when length(trim(excluded.tag_suffix)) = 4 then excluded.tag_suffix
      else listahan_public_profiles.tag_suffix
    end,
    avatar_storage_path = excluded.avatar_storage_path,
    updated_at = now();
end;
$$;

grant execute on function public.upsert_listahan_public_profile(uuid, text, text, text) to anon, authenticated;

drop function if exists public.get_listahan_public_profile(uuid);

create or replace function public.get_listahan_public_profile(p_device_profile_id uuid)
returns table (
  user_id uuid,
  username text,
  tag_suffix text,
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
    p.tag_suffix,
    p.avatar_storage_path,
    p.updated_at
  from public.listahan_public_profiles p
  where p.device_profile_id = p_device_profile_id;
$$;

grant execute on function public.get_listahan_public_profile(uuid) to anon, authenticated;
