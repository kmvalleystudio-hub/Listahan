-- Fix full-tag search when username contains underscores (e.g. @kyam_hpf4 → user kyam, suffix hpf4).

create or replace function public.search_listahan_profiles(
  p_query text,
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
  v_raw text;
  v_q text;
  v_uuid uuid;
  v_user text;
  v_suffix text;
begin
  v_raw := trim(coalesce(p_query, ''));
  if length(v_raw) < 1 then
    return;
  end if;

  if p_caller_id is null then
    raise exception 'caller_required';
  end if;

  begin
    v_uuid := v_raw::uuid;
  exception when others then
    v_uuid := null;
  end;

  if v_uuid is not null then
    return query
    select
      p.device_profile_id,
      p.username,
      p.tag_suffix,
      p.avatar_storage_path,
      p.updated_at
    from public.listahan_public_profiles p
    where p.device_profile_id = v_uuid
      and p.device_profile_id <> p_caller_id
      and length(trim(p.username)) >= 3
    limit 20;
    return;
  end if;

  v_q := lower(trim(v_raw));
  if left(v_q, 1) = '@' then
    v_q := substring(v_q from 2);
  end if;

  -- Full public tag: {username}_{4-char suffix}
  if v_q ~ '^[a-z0-9][a-z0-9_]{2,29}_[a-z0-9]{4}$' then
    v_suffix := right(v_q, 4);
    v_user := left(v_q, length(v_q) - 5);
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
    limit 20;
    return;
  end if;

  return query
  select
    p.device_profile_id,
    p.username,
    p.tag_suffix,
    p.avatar_storage_path,
    p.updated_at
  from public.listahan_public_profiles p
  where p.device_profile_id <> p_caller_id
    and length(trim(p.username)) >= 3
    and (
      lower(trim(p.username)) = v_q
      or lower(trim(p.username)) like v_q || '%'
      or (lower(trim(p.username)) || '_' || lower(trim(p.tag_suffix))) like v_q || '%'
    )
  order by
    case when lower(trim(p.username)) = v_q then 0 else 1 end,
    p.username
  limit 20;
end;
$$;

grant execute on function public.search_listahan_profiles(text, uuid) to anon, authenticated;
