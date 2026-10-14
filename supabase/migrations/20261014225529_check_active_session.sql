-- Read only the caller's signed session identifier; never accept an identifier argument.
-- Deploy this additive migration before the application starts requiring the RPC.
create function public.is_current_session_active()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  session_claim text := auth.jwt() ->> 'session_id';
begin
  if caller_id is null or session_claim is null
     or session_claim !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  -- auth.sessions.id is the primary key; this does not scan other users' sessions.
  return exists (
    select 1 from auth.sessions
    where id = session_claim::uuid and user_id = caller_id
  );
end;
$$;

revoke all on function public.is_current_session_active() from public, anon, service_role, maintenance;
grant execute on function public.is_current_session_active() to authenticated;
comment on function public.is_current_session_active() is
  'Whether the signed JWT session belongs to the caller and still exists after logout.';
