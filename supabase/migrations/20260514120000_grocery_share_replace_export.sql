-- Replace an existing grocery share payload (same id / QR / link).
-- Run in Supabase SQL editor after the initial grocery_share_exports migration.

create or replace function public.replace_grocery_share_export(p_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_len int;
  v_n int;
begin
  if p_id is null then
    raise exception 'invalid id';
  end if;

  v_len := octet_length(p_payload::text);
  if v_len is null or v_len < 2 then
    raise exception 'invalid payload';
  end if;
  if v_len > 200000 then
    raise exception 'payload too large';
  end if;

  update public.grocery_share_exports g
  set
    payload = p_payload,
    created_at = now(),
    expires_at = now() + interval '7 days'
  where g.id = p_id
    and g.expires_at > now();

  get diagnostics v_n = ROW_COUNT;
  if v_n = 0 then
    raise exception 'share not found or expired';
  end if;
end;
$$;

grant execute on function public.replace_grocery_share_export(uuid, jsonb) to anon, authenticated;
