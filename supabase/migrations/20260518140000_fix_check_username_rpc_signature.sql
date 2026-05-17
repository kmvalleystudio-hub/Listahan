-- PostgREST resolves RPC calls using argument order; JS clients typically send
-- `p_device_profile_id` then `p_username` → (uuid, text). Recreate to match.

drop function if exists public.check_listahan_username_available(text, uuid);
drop function if exists public.check_listahan_username_available(uuid, text);

create or replace function public.check_listahan_username_available(
  p_device_profile_id uuid,
  p_username text
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

grant execute on function public.check_listahan_username_available(uuid, text) to anon, authenticated;
