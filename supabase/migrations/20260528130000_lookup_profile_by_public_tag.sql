-- Sync lookup by full public tag (@username_xxxx), not bare username.

drop function if exists public.lookup_listahan_profile_by_username(text, uuid);

create or replace function public.lookup_listahan_profile_by_public_tag(
  p_username text,
  p_tag_suffix text,
  p_caller_id uuid
)
returns table (
  device_profile_id uuid,
  username text,
  tag_suffix text,
  avatar_storage_path text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user text;
  v_suffix text;
begin
  v_user := lower(trim(coalesce(p_username, '')));
  v_suffix := lower(trim(coalesce(p_tag_suffix, '')));

  if length(v_user) < 3 or length(v_suffix) <> 4 then
    return;
  end if;

  if p_caller_id is null then
    raise exception 'caller_required';
  end if;

  return query
  select
    p.device_profile_id,
    p.username,
    p.tag_suffix,
    p.avatar_storage_path,
    p.updated_at
  from public.listahan_public_profiles p
  where lower(trim(p.username)) = v_user
    and lower(trim(p.tag_suffix)) = v_suffix
    and p.device_profile_id <> p_caller_id
    and length(trim(p.username)) >= 3
  limit 1;
end;
$$;

grant execute on function public.lookup_listahan_profile_by_public_tag(text, text, uuid) to anon, authenticated;
