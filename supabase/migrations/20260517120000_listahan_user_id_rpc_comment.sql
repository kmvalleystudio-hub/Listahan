-- Surface Listahan user ID in RPC responses and document DB columns.
-- `device_profile_id` is the canonical user ID (same UUID as app `deviceProfileId`).

comment on table public.listahan_public_profiles is
  'Public profile metadata for discovery/sync, keyed by Listahan user ID (UUID).';

comment on column public.listahan_public_profiles.device_profile_id is
  'Listahan user ID (UUID). Matches UserProfile.deviceProfileId on the device; used as storage path prefix.';

drop function if exists public.get_listahan_public_profile(uuid);

create function public.get_listahan_public_profile(p_device_profile_id uuid)
returns table (
  user_id uuid,
  display_name text,
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
    p.display_name,
    p.avatar_storage_path,
    p.updated_at
  from public.listahan_public_profiles p
  where p.device_profile_id = p_device_profile_id;
$$;

grant execute on function public.get_listahan_public_profile(uuid) to anon, authenticated;
