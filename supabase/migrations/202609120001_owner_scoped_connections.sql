create table if not exists public.yahoo_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  yahoo_guid text not null unique,
  display_name text,
  email text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at bigint not null,
  token_version bigint not null default 1 check (token_version > 0),
  encryption_key_version smallint not null check (encryption_key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fantasy_memberships (
  owner_id uuid not null references auth.users(id) on delete cascade,
  league_key text not null,
  team_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, league_key, team_key),
  check (length(league_key) between 3 and 128),
  check (length(team_key) between 3 and 128)
);

alter table public.yahoo_connections enable row level security;
alter table public.yahoo_connections force row level security;
alter table public.fantasy_memberships enable row level security;
alter table public.fantasy_memberships force row level security;

create policy yahoo_connections_owner_select on public.yahoo_connections
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy yahoo_connections_owner_insert on public.yahoo_connections
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy yahoo_connections_owner_update on public.yahoo_connections
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy yahoo_connections_owner_delete on public.yahoo_connections
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy fantasy_memberships_owner_select on public.fantasy_memberships
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy fantasy_memberships_owner_insert on public.fantasy_memberships
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy fantasy_memberships_owner_update on public.fantasy_memberships
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy fantasy_memberships_owner_delete on public.fantasy_memberships
  for delete to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.upsert_yahoo_connection(
  p_yahoo_guid text,
  p_display_name text,
  p_email text,
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_token_expires_at bigint,
  p_encryption_key_version smallint
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.yahoo_connections (
    owner_id, yahoo_guid, display_name, email,
    access_token_ciphertext, refresh_token_ciphertext,
    token_expires_at, encryption_key_version
  ) values (
    auth.uid(), p_yahoo_guid, p_display_name, p_email,
    p_access_token_ciphertext, p_refresh_token_ciphertext,
    p_token_expires_at, p_encryption_key_version
  )
  on conflict (owner_id) do update set
    yahoo_guid = excluded.yahoo_guid,
    display_name = excluded.display_name,
    email = excluded.email,
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    token_expires_at = excluded.token_expires_at,
    token_version = public.yahoo_connections.token_version + 1,
    encryption_key_version = excluded.encryption_key_version,
    updated_at = now()
  returning token_version into next_version;

  return next_version;
end;
$$;

create or replace function public.rotate_yahoo_tokens(
  p_expected_version bigint,
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_token_expires_at bigint,
  p_encryption_key_version smallint
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.yahoo_connections set
    access_token_ciphertext = p_access_token_ciphertext,
    refresh_token_ciphertext = p_refresh_token_ciphertext,
    token_expires_at = p_token_expires_at,
    token_version = token_version + 1,
    encryption_key_version = p_encryption_key_version,
    updated_at = now()
  where owner_id = auth.uid() and token_version = p_expected_version;
  return found;
end;
$$;

create or replace function public.replace_fantasy_memberships(p_memberships jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or jsonb_typeof(p_memberships) <> 'array' then
    raise exception 'invalid membership replacement' using errcode = '42501';
  end if;

  delete from public.fantasy_memberships where owner_id = auth.uid();
  insert into public.fantasy_memberships (owner_id, league_key, team_key)
  select auth.uid(), item->>'league_key', item->>'team_key'
  from jsonb_array_elements(p_memberships) item;
end;
$$;

revoke all on public.yahoo_connections from anon;
revoke all on public.fantasy_memberships from anon;
grant select, insert, update, delete on public.yahoo_connections to authenticated;
grant select, insert, update, delete on public.fantasy_memberships to authenticated;
revoke all on function public.upsert_yahoo_connection(text, text, text, text, text, bigint, smallint) from public, anon;
revoke all on function public.rotate_yahoo_tokens(bigint, text, text, bigint, smallint) from public, anon;
revoke all on function public.replace_fantasy_memberships(jsonb) from public, anon;
grant execute on function public.upsert_yahoo_connection(text, text, text, text, text, bigint, smallint) to authenticated;
grant execute on function public.rotate_yahoo_tokens(bigint, text, text, bigint, smallint) to authenticated;
grant execute on function public.replace_fantasy_memberships(jsonb) to authenticated;
