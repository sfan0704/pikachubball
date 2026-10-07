-- The user's leagues (one row per league they belong to) and their saved
-- choices. fantasy_memberships stays in place so the running app keeps
-- working; reads move to user_leagues in later changes, after which that
-- table is dropped.

create table if not exists public.user_leagues (
  owner_id uuid not null references auth.users(id) on delete cascade,
  league_key text not null,
  team_key text not null,
  season integer,
  name text not null,
  is_finished boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (owner_id, league_key),
  check (length(league_key) between 3 and 128),
  check (length(team_key) between 3 and 128),
  check (season is null or season between 1990 and 2200),
  check (length(name) between 1 and 256)
);

create table if not exists public.user_preferences (
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

alter table public.user_leagues enable row level security;
alter table public.user_leagues force row level security;
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

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

create or replace function public.touch_updated_at()
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

-- Replaces all of the signed-in user's leagues in one transaction, so a sync
-- never leaves a half-updated list. Rows Yahoo no longer lists are removed.
create or replace function public.replace_user_leagues(p_leagues jsonb)
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
  insert into public.user_leagues (owner_id, league_key, team_key, season, name, is_finished)
  select
    auth.uid(),
    item->>'league_key',
    item->>'team_key',
    (item->>'season')::integer,
    item->>'name',
    coalesce((item->>'is_finished')::boolean, false)
  from jsonb_array_elements(p_leagues) item;
end;
$$;

revoke all on public.user_leagues from anon;
revoke all on public.user_preferences from anon;
grant select, insert, update, delete on public.user_leagues to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
revoke all on function public.replace_user_leagues(jsonb) from public, anon;
grant execute on function public.replace_user_leagues(jsonb) to authenticated;
revoke all on function public.touch_updated_at() from public, anon;
