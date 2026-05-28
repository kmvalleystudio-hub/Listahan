-- Exact username lookup for sync requests (no browse / prefix search).

create or replace function public.lookup_listahan_profile_by_username(
  p_username text,
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
begin
  v_user := lower(trim(coalesce(p_username, '')));
  if length(v_user) < 3 then
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
    and p.device_profile_id <> p_caller_id
    and length(trim(p.username)) >= 3
  limit 1;
end;
$$;

grant execute on function public.lookup_listahan_profile_by_username(text, uuid) to anon, authenticated;
