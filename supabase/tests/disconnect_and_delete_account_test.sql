begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '23f99d06-30ff-4767-8c41-21510b7fd5d0', 'authenticated', 'authenticated', 'a@example.test', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd86688b2-0b07-4ddc-955b-655d600312ff', 'authenticated', 'authenticated', 'b@example.test', '', now(), now());

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at) values
  ('guid-a', '23f99d06-30ff-4767-8c41-21510b7fd5d0', '{"sub":"guid-a","iss":"https://api.login.yahoo.com"}', 'custom:yahoo', now(), now()),
  ('guid-b', 'd86688b2-0b07-4ddc-955b-655d600312ff', '{"sub":"guid-b","iss":"https://api.login.yahoo.com"}', 'custom:yahoo', now(), now());

insert into public.yahoo_connections (owner_id, yahoo_guid, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, encryption_key_version)
values
  ('23f99d06-30ff-4767-8c41-21510b7fd5d0', 'guid-a', 'v1.a', 'v1.a', 1, 1),
  ('d86688b2-0b07-4ddc-955b-655d600312ff', 'guid-b', 'v1.b', 'v1.b', 1, 1);
insert into public.fantasy_memberships (owner_id, league_key, team_key)
values
  ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '466.l.1', '466.l.1.t.1'),
  ('d86688b2-0b07-4ddc-955b-655d600312ff', '466.l.2', '466.l.2.t.1');
insert into public.user_leagues (owner_id, league_key, team_key, season, name)
values
  ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '466.l.1', '466.l.1.t.1', 2025, 'League A'),
  ('d86688b2-0b07-4ddc-955b-655d600312ff', '466.l.2', '466.l.2.t.1', 2025, 'League B');
insert into public.user_preferences (owner_id, selected_league_key)
values
  ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '466.l.1'),
  ('d86688b2-0b07-4ddc-955b-655d600312ff', '466.l.2');

-- Anonymous callers can run neither function.
set local role anon;
select throws_ok($$select public.disconnect_yahoo()$$, '42501', null, 'anon cannot disconnect');
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'anon cannot delete an account');

-- Disconnect as owner A removes A's tokens and leagues, and nothing else.
set local role authenticated;
select set_config('request.jwt.claim.sub', '23f99d06-30ff-4767-8c41-21510b7fd5d0', true);
select lives_ok($$select public.disconnect_yahoo()$$, 'owner A can disconnect Yahoo');
select is((select count(*)::int from public.yahoo_connections), 0, 'A has no connection after disconnecting');
select is((select count(*)::int from public.fantasy_memberships), 0, 'A has no memberships after disconnecting');
select is((select count(*)::int from public.user_leagues), 0, 'A has no leagues after disconnecting');
select is((select count(*)::int from public.user_preferences), 1, 'A keeps their preferences after disconnecting');

reset role;
select is(
  (select count(*)::int from public.yahoo_connections where owner_id = 'd86688b2-0b07-4ddc-955b-655d600312ff'),
  1,
  'disconnecting A leaves B''s connection'
);
select is(
  (select count(*)::int from public.user_leagues where owner_id = 'd86688b2-0b07-4ddc-955b-655d600312ff'),
  1,
  'disconnecting A leaves B''s leagues'
);

-- Deleting the account as owner B removes B and everything B owns, and not A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd86688b2-0b07-4ddc-955b-655d600312ff', true);
select lives_ok($$select public.delete_my_account()$$, 'owner B can delete their account');

reset role;
select is((select count(*)::int from auth.users where id = 'd86688b2-0b07-4ddc-955b-655d600312ff'), 0, 'B''s user is gone');
select is(
  (select count(*)::int from (
    select owner_id from public.yahoo_connections
    union all select owner_id from public.fantasy_memberships
    union all select owner_id from public.user_leagues
    union all select owner_id from public.user_preferences
  ) rows where owner_id = 'd86688b2-0b07-4ddc-955b-655d600312ff'),
  0,
  'deletion leaves no row owned by B'
);
select is((select count(*)::int from auth.users where id = '23f99d06-30ff-4767-8c41-21510b7fd5d0'), 1, 'A''s user is untouched');
select is((select count(*)::int from public.user_preferences where owner_id = '23f99d06-30ff-4767-8c41-21510b7fd5d0'), 1, 'A''s preferences are untouched');

-- A signed-in user cannot name another account: the function takes no id, and
-- with no session at all it refuses.
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'a call with no session is refused');
reset role;
select is((select count(*)::int from auth.users where id = '23f99d06-30ff-4767-8c41-21510b7fd5d0'), 1, 'A''s user still exists');

select * from finish();
rollback;
