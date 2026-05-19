-- Listahan user sync: profile search, requests, sessions, snapshots, RPCs.

-- ---------------------------------------------------------------------------
-- Profile search
-- ---------------------------------------------------------------------------

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

  if v_q ~ '^[a-z0-9][a-z0-9_]{2,29}_[a-z0-9]{4}$' then
    v_user := split_part(v_q, '_', 1);
    v_suffix := right(v_q, 4);
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

-- ---------------------------------------------------------------------------
-- Sync requests
-- ---------------------------------------------------------------------------

create table if not exists public.listahan_sync_requests (
  id uuid primary key default gen_random_uuid(),
  from_device_id uuid not null,
  to_device_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  tools jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists listahan_sync_requests_to_pending_idx
  on public.listahan_sync_requests (to_device_id, created_at desc)
  where status = 'pending';

create index if not exists listahan_sync_requests_from_idx
  on public.listahan_sync_requests (from_device_id, created_at desc);

alter table public.listahan_sync_requests enable row level security;

-- ---------------------------------------------------------------------------
-- Sync sessions
-- ---------------------------------------------------------------------------

create table if not exists public.listahan_sync_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.listahan_sync_requests (id) on delete cascade,
  initiator_id uuid not null,
  recipient_id uuid not null,
  tools jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists listahan_sync_sessions_participants_idx
  on public.listahan_sync_sessions (initiator_id, recipient_id)
  where status = 'active';

alter table public.listahan_sync_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- Sync snapshots (staging on request_id, then session_id after accept)
-- ---------------------------------------------------------------------------

create table if not exists public.listahan_sync_snapshots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.listahan_sync_requests (id) on delete cascade,
  session_id uuid references public.listahan_sync_sessions (id) on delete cascade,
  tool_key text not null check (tool_key in ('grocery', 'todo', 'notes', 'reminders', 'vault')),
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  constraint listahan_sync_snapshots_target_chk check (
    (request_id is not null and session_id is null)
    or (request_id is null and session_id is not null)
  )
);

create unique index if not exists listahan_sync_snapshots_request_tool_uidx
  on public.listahan_sync_snapshots (request_id, tool_key)
  where session_id is null;

create unique index if not exists listahan_sync_snapshots_session_tool_uidx
  on public.listahan_sync_snapshots (session_id, tool_key)
  where session_id is not null;

alter table public.listahan_sync_snapshots enable row level security;

-- Enable Realtime for these tables in Supabase Dashboard if not auto-applied:
-- listahan_sync_snapshots, listahan_sync_requests

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.sync_tools_has_enabled(p_tools jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(
    (p_tools->>'grocery')::boolean,
    false
  )
  or coalesce((p_tools->>'todo')::boolean, false)
  or coalesce((p_tools->>'notes')::boolean, false)
  or coalesce((p_tools->>'reminders')::boolean, false)
  or coalesce((p_tools->>'vault')::boolean, false);
$$;

-- ---------------------------------------------------------------------------
-- create_sync_request
-- ---------------------------------------------------------------------------

create or replace function public.create_sync_request(
  p_from_device_id uuid,
  p_to_device_id uuid,
  p_tools jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_from_device_id is null or p_to_device_id is null then
    raise exception 'device_id_required';
  end if;
  if p_from_device_id = p_to_device_id then
    raise exception 'cannot_sync_with_self';
  end if;
  if not public.sync_tools_has_enabled(p_tools) then
    raise exception 'no_tools_selected';
  end if;

  if exists (
    select 1 from public.listahan_sync_requests r
    where r.status = 'pending'
      and r.from_device_id = p_from_device_id
      and r.to_device_id = p_to_device_id
  ) then
    raise exception 'pending_request_exists';
  end if;

  if exists (
    select 1 from public.listahan_sync_sessions s
    where s.status = 'active'
      and (
        (s.initiator_id = p_from_device_id and s.recipient_id = p_to_device_id)
        or (s.initiator_id = p_to_device_id and s.recipient_id = p_from_device_id)
      )
  ) then
    raise exception 'active_session_exists';
  end if;

  insert into public.listahan_sync_requests (from_device_id, to_device_id, tools)
  values (p_from_device_id, p_to_device_id, coalesce(p_tools, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_sync_request(uuid, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_sync_requests
-- ---------------------------------------------------------------------------

create or replace function public.list_sync_requests(
  p_device_id uuid,
  p_direction text default 'incoming'
)
returns table (
  id uuid,
  from_device_id uuid,
  to_device_id uuid,
  status text,
  tools jsonb,
  created_at timestamptz,
  from_username text,
  from_tag_suffix text,
  from_avatar_storage_path text,
  to_username text,
  to_tag_suffix text,
  to_avatar_storage_path text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.from_device_id,
    r.to_device_id,
    r.status,
    r.tools,
    r.created_at,
    pf.username as from_username,
    pf.tag_suffix as from_tag_suffix,
    pf.avatar_storage_path as from_avatar_storage_path,
    pt.username as to_username,
    pt.tag_suffix as to_tag_suffix,
    pt.avatar_storage_path as to_avatar_storage_path
  from public.listahan_sync_requests r
  left join public.listahan_public_profiles pf on pf.device_profile_id = r.from_device_id
  left join public.listahan_public_profiles pt on pt.device_profile_id = r.to_device_id
  where r.status = 'pending'
    and (
      (p_direction = 'incoming' and r.to_device_id = p_device_id)
      or (p_direction = 'outgoing' and r.from_device_id = p_device_id)
    )
  order by r.created_at desc
  limit 50;
$$;

grant execute on function public.list_sync_requests(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- upsert_sync_snapshot (staging or session)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_sync_snapshot(
  p_actor_id uuid,
  p_request_id uuid,
  p_session_id uuid,
  p_tool_key text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if p_actor_id is null then
    raise exception 'actor_required';
  end if;
  if p_tool_key not in ('grocery', 'todo', 'notes', 'reminders', 'vault') then
    raise exception 'invalid_tool_key';
  end if;

  if p_request_id is not null then
    select * into v_row from public.listahan_sync_requests r where r.id = p_request_id;
    if not found then
      raise exception 'request_not_found';
    end if;
    if v_row.status <> 'pending' and p_session_id is null then
      raise exception 'request_not_pending';
    end if;
    if p_actor_id <> v_row.from_device_id then
      raise exception 'not_request_initiator';
    end if;

    update public.listahan_sync_snapshots
    set
      payload = coalesce(p_payload, '{}'::jsonb),
      version = version + 1,
      updated_by = p_actor_id,
      updated_at = now()
    where request_id = p_request_id
      and tool_key = p_tool_key
      and session_id is null;

    if not found then
      insert into public.listahan_sync_snapshots (
        request_id, session_id, tool_key, payload, version, updated_by, updated_at
      )
      values (
        p_request_id, null, p_tool_key, coalesce(p_payload, '{}'::jsonb), 1, p_actor_id, now()
      );
    end if;
    return;
  end if;

  if p_session_id is null then
    raise exception 'request_or_session_required';
  end if;

  select * into v_row from public.listahan_sync_sessions s where s.id = p_session_id;
  if not found then
    raise exception 'session_not_found';
  end if;
  if v_row.status <> 'active' then
    raise exception 'session_not_active';
  end if;
  if p_actor_id <> v_row.initiator_id and p_actor_id <> v_row.recipient_id then
    raise exception 'not_session_participant';
  end if;

  update public.listahan_sync_snapshots
  set
    payload = coalesce(p_payload, '{}'::jsonb),
    version = version + 1,
    updated_by = p_actor_id,
    updated_at = now()
  where session_id = p_session_id
    and tool_key = p_tool_key;

  if not found then
    insert into public.listahan_sync_snapshots (
      request_id, session_id, tool_key, payload, version, updated_by, updated_at
    )
    values (
      null, p_session_id, p_tool_key, coalesce(p_payload, '{}'::jsonb), 1, p_actor_id, now()
    );
  end if;
end;
$$;

grant execute on function public.upsert_sync_snapshot(uuid, uuid, uuid, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- respond_sync_request
-- ---------------------------------------------------------------------------

create or replace function public.respond_sync_request(
  p_request_id uuid,
  p_device_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.listahan_sync_requests%rowtype;
  v_session_id uuid;
begin
  select * into v_req from public.listahan_sync_requests r where r.id = p_request_id;
  if not found then
    raise exception 'request_not_found';
  end if;
  if v_req.to_device_id <> p_device_id then
    raise exception 'not_request_recipient';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;

  if not p_accept then
    update public.listahan_sync_requests
    set status = 'rejected', responded_at = now()
    where id = p_request_id;
    return null;
  end if;

  update public.listahan_sync_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id;

  insert into public.listahan_sync_sessions (request_id, initiator_id, recipient_id, tools)
  values (v_req.id, v_req.from_device_id, v_req.to_device_id, v_req.tools)
  returning id into v_session_id;

  insert into public.listahan_sync_snapshots (
    session_id, request_id, tool_key, payload, version, updated_by, updated_at
  )
  select
    v_session_id,
    null,
    s.tool_key,
    s.payload,
    s.version,
    s.updated_by,
    s.updated_at
  from public.listahan_sync_snapshots s
  where s.request_id = p_request_id;

  delete from public.listahan_sync_snapshots where request_id = p_request_id;

  return v_session_id;
end;
$$;

grant execute on function public.respond_sync_request(uuid, uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_sync_session
-- ---------------------------------------------------------------------------

create or replace function public.get_sync_session(p_device_id uuid)
returns table (
  session_id uuid,
  request_id uuid,
  initiator_id uuid,
  recipient_id uuid,
  tools jsonb,
  status text,
  created_at timestamptz,
  partner_id uuid,
  partner_username text,
  partner_tag_suffix text,
  partner_avatar_storage_path text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id as session_id,
    s.request_id,
    s.initiator_id,
    s.recipient_id,
    s.tools,
    s.status,
    s.created_at,
    case when s.initiator_id = p_device_id then s.recipient_id else s.initiator_id end as partner_id,
    p.username as partner_username,
    p.tag_suffix as partner_tag_suffix,
    p.avatar_storage_path as partner_avatar_storage_path
  from public.listahan_sync_sessions s
  left join public.listahan_public_profiles p
    on p.device_profile_id = case
      when s.initiator_id = p_device_id then s.recipient_id
      else s.initiator_id
    end
  where s.status = 'active'
    and (s.initiator_id = p_device_id or s.recipient_id = p_device_id)
  order by s.created_at desc
  limit 1;
$$;

grant execute on function public.get_sync_session(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_sync_snapshots
-- ---------------------------------------------------------------------------

create or replace function public.list_sync_snapshots(p_session_id uuid, p_device_id uuid)
returns table (
  tool_key text,
  payload jsonb,
  version integer,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.listahan_sync_sessions s
    where s.id = p_session_id
      and s.status = 'active'
      and (s.initiator_id = p_device_id or s.recipient_id = p_device_id)
  ) then
    raise exception 'session_not_found';
  end if;

  return query
  select sn.tool_key, sn.payload, sn.version, sn.updated_by, sn.updated_at
  from public.listahan_sync_snapshots sn
  where sn.session_id = p_session_id
  order by sn.tool_key;
end;
$$;

grant execute on function public.list_sync_snapshots(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- update_sync_session_tools
-- ---------------------------------------------------------------------------

create or replace function public.update_sync_session_tools(
  p_session_id uuid,
  p_device_id uuid,
  p_tools jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sync_tools_has_enabled(p_tools) then
    raise exception 'no_tools_selected';
  end if;

  update public.listahan_sync_sessions s
  set tools = coalesce(p_tools, '{}'::jsonb)
  where s.id = p_session_id
    and s.status = 'active'
    and (s.initiator_id = p_device_id or s.recipient_id = p_device_id);

  if not found then
    raise exception 'session_not_found';
  end if;
end;
$$;

grant execute on function public.update_sync_session_tools(uuid, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- end_sync_session
-- ---------------------------------------------------------------------------

create or replace function public.end_sync_session(
  p_session_id uuid,
  p_device_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listahan_sync_sessions s
  set status = 'ended', ended_at = now()
  where s.id = p_session_id
    and s.status = 'active'
    and (s.initiator_id = p_device_id or s.recipient_id = p_device_id);

  if not found then
    raise exception 'session_not_found';
  end if;

  delete from public.listahan_sync_snapshots where session_id = p_session_id;
end;
$$;

grant execute on function public.end_sync_session(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- count_pending_sync_requests
-- ---------------------------------------------------------------------------

create or replace function public.count_pending_sync_requests(p_device_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.listahan_sync_requests r
  where r.to_device_id = p_device_id and r.status = 'pending';
$$;

grant execute on function public.count_pending_sync_requests(uuid) to anon, authenticated;
