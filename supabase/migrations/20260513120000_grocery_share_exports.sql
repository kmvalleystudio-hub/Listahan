-- Grocery list share payloads (anonymous RPC upload + fetch by secret UUID).
-- Run once in the Supabase SQL editor (or via Supabase CLI).
--
-- App env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

create extension if not exists pgcrypto;

create table if not exists public.grocery_share_exports (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.grocery_share_exports enable row level security;

create or replace function public.create_grocery_share_export(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_len int;
begin
  v_len := octet_length(p_payload::text);
  if v_len is null or v_len < 2 then
    raise exception 'invalid payload';
  end if;
  if v_len > 200000 then
    raise exception 'payload too large';
  end if;

  insert into public.grocery_share_exports (payload, expires_at)
  values (p_payload, now() + interval '7 days')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_grocery_share_export(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select g.payload
  from public.grocery_share_exports g
  where g.id = p_id
    and g.expires_at > now()
  limit 1;
$$;

grant execute on function public.create_grocery_share_export(jsonb) to anon, authenticated;
grant execute on function public.get_grocery_share_export(uuid) to anon, authenticated;
