begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '23f99d06-30ff-4767-8c41-21510b7fd5d0', 'authenticated', 'authenticated', 'a@example.test', '', now(), now());

insert into public.user_leagues (owner_id, league_key, team_key, season, name, status)
values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '478.l.1', '478.l.1.t.1', 2026, 'League', 'preseason');
insert into public.user_preferences (owner_id, selected_league_key)
values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '478.l.1');

select ok(
  not (select rolsuper or rolbypassrls or rolcreaterole or rolcreatedb from pg_roles where rolname = 'maintenance'),
  'the maintenance role has no special powers'
);

-- Only so the test can call pgTAP as this role; rolled back with the test.
grant usage on schema extensions to maintenance;
set local role maintenance;

select ok((select 1) = 1, 'the maintenance role can run the keep-alive query');

select is((select count(*)::integer from public.user_leagues), 0, 'it reads no leagues');
select is((select count(*)::integer from public.user_preferences), 0, 'it reads no preferences');
select is((select count(*)::integer from public.yahoo_connections), 0, 'it reads no Yahoo connections');
select is((select count(*)::integer from public.fantasy_memberships), 0, 'it reads no memberships');

select lives_ok(
  $$lock table public.user_leagues, public.user_preferences, public.yahoo_connections,
    public.fantasy_memberships in access share mode$$,
  'it can take the locks a schema dump takes'
);

select throws_ok(
  $$insert into public.user_leagues (owner_id, league_key, team_key, name, status)
    values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '478.l.2', '478.l.2.t.1', 'Forged', 'active')$$,
  '42501',
  null,
  'it cannot add leagues'
);

select throws_ok(
  $$update public.user_leagues set name = 'Changed'$$,
  '42501',
  null,
  'it cannot change leagues'
);

select throws_ok(
  $$select public.delete_my_account()$$,
  '42501',
  null,
  'it cannot run the account functions'
);

reset role;

select is(
  (select name from public.user_leagues where league_key = '478.l.1'),
  'League',
  'nothing it tried changed the data'
);

select * from finish();
rollback;
