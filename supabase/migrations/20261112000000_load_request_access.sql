-- One round trip for what every signed-in request checks before it calls Yahoo
-- (FAN-121): the session is still live (CAR-132), the caller's Yahoo identity,
-- whether the requested league is theirs, and their encrypted Yahoo tokens.
-- Before this, a request made about four calls to Supabase one after another.
--
-- Runs with the owner's rights because ordinary users cannot read auth.sessions
-- or auth.identities. It takes no user id: every read is filtered to the signed
-- caller (auth.uid()) and their signed session_id, exactly as
-- is_current_session_active does. A session that is no longer active gets
-- nothing but {"active": false}.
create function public.load_request_access(p_league_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  identity_row record;
  connection_row record;
begin
  if not public.is_current_session_active() then
    return jsonb_build_object('active', false);
  end if;

  -- Mirrors enforce_verified_yahoo_guid: the custom:yahoo identity Yahoo issued.
  select identity.identity_data->>'sub' as yahoo_guid,
         identity.identity_data->>'name' as display_name
    into identity_row
    from auth.identities identity
   where identity.user_id = caller_id
     and identity.provider = 'custom:yahoo'
     and identity.identity_data->>'iss' = 'https://api.login.yahoo.com'
   order by identity.created_at
   limit 1;

  select connection.access_token_ciphertext,
         connection.refresh_token_ciphertext,
         connection.token_expires_at,
         connection.token_version
    into connection_row
    from public.yahoo_connections connection
   where connection.owner_id = caller_id;

  return jsonb_build_object(
    'active', true,
    'yahoo_guid', identity_row.yahoo_guid,
    'display_name', identity_row.display_name,
    'owns_league', case
      when p_league_key is null then null
      else exists (
        select 1 from public.user_leagues league
         where league.owner_id = caller_id and league.league_key = p_league_key
      )
    end,
    'connection', case
      when connection_row.token_version is null then null
      else jsonb_build_object(
        'access_token_ciphertext', connection_row.access_token_ciphertext,
        'refresh_token_ciphertext', connection_row.refresh_token_ciphertext,
        'token_expires_at', connection_row.token_expires_at,
        'token_version', connection_row.token_version
      )
    end
  );
end;
$$;

comment on function public.load_request_access(text) is
  'One call per request: whether the session is live, the caller''s Yahoo identity, league ownership and encrypted tokens.';

revoke all on function public.load_request_access(text)
from public, anon, authenticated, service_role, maintenance;
grant execute on function public.load_request_access(text) to authenticated;
