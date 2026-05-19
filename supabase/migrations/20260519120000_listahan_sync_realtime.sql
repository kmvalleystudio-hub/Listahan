-- Enable Supabase Realtime for sync tables (live snapshot + incoming request badge).

do $$
begin
  alter publication supabase_realtime add table public.listahan_sync_snapshots;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.listahan_sync_requests;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.listahan_sync_sessions;
exception
  when duplicate_object then null;
end $$;
