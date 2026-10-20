-- The whole schema as of 2026-10-19, folded from the seven earlier migrations
-- (CAR-138) so production can start clean from one file. Later changes are new
-- migrations on top of this one, never edits to it.
--
-- Every privilege is revoked and granted explicitly. Hosted projects and the
-- local stack grant different defaults to new tables and functions, so relying
-- on them would make the release drift check (scripts/release/drift.mts) see a
-- difference the migrations never asked for.

-- The role the weekly Scheduled jobs use: a keep-alive query and a schema
-- dump, run without anyone approving them. pg_dump locks every table it dumps,
-- and that lock needs SELECT, so the role has SELECT on the public tables.
-- Every one of them forces row-level security with policies for signed-in
-- users only, so this role reads no rows and can change nothing. It can't
-- sign in until the owner gives it a password (docs/runbooks/release.md).
-- A migration that adds a table grants SELECT on it to maintenance and forces
-- row-level security on it; otherwise the weekly dump fails on that table.
do $$
begin
  if not exists (select from pg_roles where rolname = 'maintenance') then
    create role maintenance nologin noinherit;
  end if;
end
$$;

-- The database owner can act as it, as it can as any role it manages (the
-- access-rule tests use this).
grant maintenance to postgres;
grant usage on schema public to maintenance;

-- Tables

create table public.yahoo_connections (
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

-- Superseded by user_leagues; kept until no running code writes it.
create table public.fantasy_memberships (
  owner_id uuid not null references auth.users(id) on delete cascade,
  league_key text not null,
  team_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, league_key, team_key),
  check (length(league_key) between 3 and 128),
  check (length(team_key) between 3 and 128)
);

-- The user's leagues, one row per league they belong to. A league's status is
-- preseason (not drafted or not started), active or finished; is_finished stays,
-- kept consistent with status, until no running code reads it.
create table public.user_leagues (
  owner_id uuid not null references auth.users(id) on delete cascade,
  league_key text not null,
  team_key text not null,
  season integer,
  name text not null,
  is_finished boolean not null default false,
  synced_at timestamptz not null default now(),
  status text not null,
  primary key (owner_id, league_key),
  check (length(league_key) between 3 and 128),
  check (length(team_key) between 3 and 128),
  check (season is null or season between 1990 and 2200),
  check (length(name) between 1 and 256),
  constraint user_leagues_status_known check (status in ('preseason', 'active', 'finished')),
  constraint user_leagues_status_matches_finished check ((status = 'finished') = is_finished)
);

-- The user's saved choices.
create table public.user_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  selected_league_key text,
  selected_team_key text,
  display jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (selected_league_key is null or length(selected_league_key) between 3 and 128),
  check (selected_team_key is null or length(selected_team_key) between 3 and 128),
  check (jsonb_typeof(display) = 'object'),
  check (pg_column_size(display) <= 4096)
);

alter table public.yahoo_connections enable row level security;
alter table public.yahoo_connections force row level security;
alter table public.fantasy_memberships enable row level security;
alter table public.fantasy_memberships force row level security;
alter table public.user_leagues enable row level security;
alter table public.user_leagues force row level security;
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

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

create policy user_leagues_owner_select on public.user_leagues
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy user_leagues_owner_insert on public.user_leagues
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy user_leagues_owner_update on public.user_leagues
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy user_leagues_owner_delete on public.user_leagues
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy user_preferences_owner_select on public.user_preferences
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy user_preferences_owner_insert on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy user_preferences_owner_update on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy user_preferences_owner_delete on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Triggers

-- A connection's yahoo_guid must be its owner's verified Yahoo subject. Without
-- this, any authenticated user could write another manager's GUID into their
-- own row through the Data API and, because the column is unique, block that
-- manager from connecting. The subject and issuer mirror the server's
-- readYahooSessionIdentity: the custom:yahoo identity's `sub` from Yahoo.
create function public.enforce_verified_yahoo_guid()
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

create trigger yahoo_connections_verified_guid
  before insert or update of owner_id, yahoo_guid on public.yahoo_connections
  for each row execute function public.enforce_verified_yahoo_guid();

create function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_preferences_touch_updated_at
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();

-- Functions the signed-in user calls

create function public.upsert_yahoo_connection(
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

create function public.rotate_yahoo_tokens(
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

create function public.replace_fantasy_memberships(p_memberships jsonb)
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

-- Replaces all of the signed-in user's leagues in one transaction, so a sync
-- never leaves a half-updated list. Rows Yahoo no longer lists are removed.
-- Older code sends only is_finished and newer code sends status; both work.
create function public.replace_user_leagues(p_leagues jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or jsonb_typeof(p_leagues) <> 'array' then
    raise exception 'invalid league replacement' using errcode = '42501';
  end if;

  delete from public.user_leagues where owner_id = auth.uid();
  insert into public.user_leagues (owner_id, league_key, team_key, season, name, status, is_finished)
  select
    auth.uid(),
    item->>'league_key',
    item->>'team_key',
    (item->>'season')::integer,
    item->>'name',
    league.status,
    league.status = 'finished'
  from jsonb_array_elements(p_leagues) item
  cross join lateral (
    select coalesce(
      item->>'status',
      case when coalesce((item->>'is_finished')::boolean, false) then 'finished' else 'active' end
    ) as status
  ) league;
end;
$$;

-- Disconnecting Yahoo removes the user's stored tokens and leagues in one
-- transaction. Deleting the account removes the Supabase user, and the
-- cascading foreign keys remove every row they own. Both act only on the
-- signed-in user; the server never needs the admin key for either.
create function public.disconnect_yahoo()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.yahoo_connections where owner_id = auth.uid();
  delete from public.fantasy_memberships where owner_id = auth.uid();
  delete from public.user_leagues where owner_id = auth.uid();
end;
$$;

-- Runs with the owner's rights because ordinary users cannot touch auth.users,
-- but only ever for the caller's own id.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Read only the caller's signed session identifier; never accept an identifier argument.
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

comment on function public.is_current_session_active() is
  'Whether the signed JWT session belongs to the caller and still exists after logout.';

-- Privileges: nothing by default, then exactly what each role needs.

revoke all on table
  public.yahoo_connections,
  public.fantasy_memberships,
  public.user_leagues,
  public.user_preferences
from public, anon, authenticated, service_role, maintenance;
grant select, insert, update, delete on table
  public.yahoo_connections,
  public.fantasy_memberships,
  public.user_leagues,
  public.user_preferences
to authenticated;
grant select on table
  public.yahoo_connections,
  public.fantasy_memberships,
  public.user_leagues,
  public.user_preferences
to maintenance;

revoke all on function
  public.enforce_verified_yahoo_guid(),
  public.touch_updated_at(),
  public.upsert_yahoo_connection(text, text, text, text, text, bigint, smallint),
  public.rotate_yahoo_tokens(bigint, text, text, bigint, smallint),
  public.replace_fantasy_memberships(jsonb),
  public.replace_user_leagues(jsonb),
  public.disconnect_yahoo(),
  public.delete_my_account(),
  public.is_current_session_active()
from public, anon, authenticated, service_role, maintenance;
grant execute on function
  public.upsert_yahoo_connection(text, text, text, text, text, bigint, smallint),
  public.rotate_yahoo_tokens(bigint, text, text, bigint, smallint),
  public.replace_fantasy_memberships(jsonb),
  public.replace_user_leagues(jsonb),
  public.disconnect_yahoo(),
  public.delete_my_account(),
  public.is_current_session_active()
to authenticated;
