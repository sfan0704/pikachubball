-- A connection's yahoo_guid must be its owner's verified Yahoo subject. Without
-- this, any authenticated user could write another manager's GUID into their
-- own row through the Data API and, because the column is unique, block that
-- manager from connecting. The subject and issuer mirror the server's
-- readYahooSessionIdentity: the custom:yahoo identity's `sub` from Yahoo.
create or replace function public.enforce_verified_yahoo_guid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_guid text;
begin
  select identity.identity_data->>'sub'
    into verified_guid
    from auth.identities identity
   where identity.user_id = new.owner_id
     and identity.provider = 'custom:yahoo'
     and identity.identity_data->>'iss' = 'https://api.login.yahoo.com'
   order by identity.created_at
   limit 1;

  if verified_guid is null or new.yahoo_guid is distinct from verified_guid then
    raise exception 'yahoo_guid must match the owner''s verified Yahoo identity'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_verified_yahoo_guid() from public, anon, authenticated;

create trigger yahoo_connections_verified_guid
  before insert or update of owner_id, yahoo_guid on public.yahoo_connections
  for each row execute function public.enforce_verified_yahoo_guid();
