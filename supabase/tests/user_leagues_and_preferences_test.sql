begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(23);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '23f99d06-30ff-4767-8c41-21510b7fd5d0', 'authenticated', 'authenticated', 'a@example.test', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd86688b2-0b07-4ddc-955b-655d600312ff', 'authenticated', 'authenticated', 'b@example.test', '', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '23f99d06-30ff-4767-8c41-21510b7fd5d0', true);

select lives_ok(
  $$select public.replace_user_leagues('[
    {"league_key":"466.l.1","team_key":"466.l.1.t.1","season":2025,"name":"League One","is_finished":false},
    {"league_key":"454.l.9","team_key":"454.l.9.t.3","season":2024,"name":"Old League","is_finished":true}
  ]'::jsonb)$$,
  'owner A can replace its leagues'
);

select results_eq(
  $$select league_key, team_key, season, name, is_finished from public.user_leagues order by league_key$$,
  $$values ('454.l.9'::text, '454.l.9.t.3'::text, 2024, 'Old League'::text, true),
           ('466.l.1'::text, '466.l.1.t.1'::text, 2025, 'League One'::text, false)$$,
  'owner A can read its leagues with every field'
);

select lives_ok(
  $$select public.replace_user_leagues('[
    {"league_key":"466.l.1","team_key":"466.l.1.t.1","season":2025,"name":"League One","is_finished":false}
  ]'::jsonb)$$,
  'a second replacement succeeds'
);

select results_eq(
  $$select league_key from public.user_leagues$$,
  $$values ('466.l.1'::text)$$,
  'a replacement removes leagues Yahoo no longer lists'
);

select throws_ok(
  $$select public.replace_user_leagues('{"league_key":"x"}'::jsonb)$$,
  '42501',
  null,
  'a non-array replacement is refused'
);

select throws_ok(
  $$select public.replace_user_leagues('[{"league_key":"466.l.2","team_key":"466.l.2.t.1","name":""}]'::jsonb)$$,
  '23514',
  null,
  'an empty league name is refused'
);

select results_eq(
  $$select league_key from public.user_leagues$$,
  $$values ('466.l.1'::text)$$,
  'a refused replacement leaves the previous list intact'
);

select lives_ok(
  $$insert into public.user_preferences (owner_id, selected_league_key, selected_team_key, display)
    values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '466.l.1', '466.l.1.t.1', '{"theme":"dark"}')$$,
  'owner A can save preferences'
);

select throws_ok(
  $$insert into public.user_preferences (owner_id, display)
    values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '{}')$$,
  '23505',
  null,
  'there is one preferences row per owner'
);

select throws_ok(
  $$update public.user_preferences set display = '[1,2]'::jsonb$$,
  '23514',
  null,
  'display choices must be an object'
);

select throws_ok(
  $$update public.user_preferences set display = jsonb_build_object('blob', repeat('x', 5000))$$,
  '23514',
  null,
  'display choices are capped in size'
);

select is(
  (select updated_at > now() - interval '1 minute' from public.user_preferences),
  true,
  'updated_at is set'
);

select lives_ok(
  $$update public.user_preferences set selected_league_key = '466.l.1', display = '{"theme":"light"}'$$,
  'owner A can update its preferences'
);

select set_config('request.jwt.claim.sub', 'd86688b2-0b07-4ddc-955b-655d600312ff', true);

select is_empty(
  $$select owner_id from public.user_leagues$$,
  'owner B cannot read owner A leagues'
);

select is_empty(
  $$select owner_id from public.user_preferences$$,
  'owner B cannot read owner A preferences'
);

select throws_ok(
  $$insert into public.user_leagues (owner_id, league_key, team_key, name, status)
    values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '466.l.3', '466.l.3.t.1', 'Forged', 'active')$$,
  '42501',
  null,
  'owner B cannot insert a league for owner A'
);

select throws_ok(
  $$insert into public.user_preferences (owner_id) values ('23f99d06-30ff-4767-8c41-21510b7fd5d0')$$,
  '42501',
  null,
  'owner B cannot insert preferences for owner A'
);

select is_empty(
  $$update public.user_leagues set name = 'forged' returning owner_id$$,
  'an update cannot affect an invisible foreign league'
);

select is_empty(
  $$delete from public.user_preferences returning owner_id$$,
  'a delete cannot remove an invisible foreign preferences row'
);

select lives_ok(
  $$select public.replace_user_leagues('[
    {"league_key":"466.l.7","team_key":"466.l.7.t.2","season":2025,"name":"B League","is_finished":false}
  ]'::jsonb)$$,
  'owner B replaces only its own leagues'
);

select set_config('request.jwt.claim.sub', '23f99d06-30ff-4767-8c41-21510b7fd5d0', true);

select results_eq(
  $$select league_key from public.user_leagues$$,
  $$values ('466.l.1'::text)$$,
  'owner B''s replacement did not touch owner A'
);

reset role;
delete from auth.users where id = '23f99d06-30ff-4767-8c41-21510b7fd5d0';

select is(
  (select count(*) from public.user_leagues where owner_id = '23f99d06-30ff-4767-8c41-21510b7fd5d0')
  + (select count(*) from public.user_preferences where owner_id = '23f99d06-30ff-4767-8c41-21510b7fd5d0'),
  0::bigint,
  'deleting the user deletes their leagues and preferences'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select throws_ok(
  $$select owner_id from public.user_leagues$$,
  '42501',
  null,
  'anonymous requests cannot read leagues or preferences'
);

select * from finish();
rollback;
