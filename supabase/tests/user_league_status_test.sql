begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '23f99d06-30ff-4767-8c41-21510b7fd5d0', 'authenticated', 'authenticated', 'a@example.test', '', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '23f99d06-30ff-4767-8c41-21510b7fd5d0', true);

-- The app that predates the status column sends only is_finished.
select lives_ok(
  $$select public.replace_user_leagues('[
    {"league_key":"466.l.1","team_key":"466.l.1.t.1","season":2025,"name":"Last Season","is_finished":true},
    {"league_key":"478.l.1","team_key":"478.l.1.t.1","season":2026,"name":"This Season","is_finished":false}
  ]'::jsonb)$$,
  'a replacement without status still succeeds'
);

select results_eq(
  $$select league_key, status, is_finished from public.user_leagues order by league_key$$,
  $$values ('466.l.1'::text, 'finished'::text, true), ('478.l.1'::text, 'active'::text, false)$$,
  'without status, it follows is_finished'
);

-- Newer code sends status; is_finished follows it.
select lives_ok(
  $$select public.replace_user_leagues('[
    {"league_key":"466.l.1","team_key":"466.l.1.t.1","season":2025,"name":"Last Season","status":"finished"},
    {"league_key":"478.l.1","team_key":"478.l.1.t.1","season":2026,"name":"This Season","status":"preseason"},
    {"league_key":"478.l.2","team_key":"478.l.2.t.5","season":2026,"name":"Other League","status":"active"}
  ]'::jsonb)$$,
  'a replacement with status succeeds'
);

select results_eq(
  $$select league_key, status, is_finished from public.user_leagues order by league_key$$,
  $$values ('466.l.1'::text, 'finished'::text, true),
           ('478.l.1'::text, 'preseason'::text, false),
           ('478.l.2'::text, 'active'::text, false)$$,
  'status is stored and is_finished is derived from it'
);

select throws_ok(
  $$select public.replace_user_leagues('[
    {"league_key":"478.l.1","team_key":"478.l.1.t.1","season":2026,"name":"This Season","status":"paused"}
  ]'::jsonb)$$,
  '23514',
  null,
  'an unknown status is refused'
);

select results_eq(
  $$select count(*)::integer from public.user_leagues$$,
  $$values (3)$$,
  'a refused replacement leaves the stored leagues unchanged'
);

select throws_ok(
  $$insert into public.user_leagues (owner_id, league_key, team_key, name, status, is_finished)
    values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '478.l.9', '478.l.9.t.1', 'Mismatch', 'active', true)$$,
  '23514',
  null,
  'status and is_finished cannot disagree'
);

select throws_ok(
  $$insert into public.user_leagues (owner_id, league_key, team_key, name, is_finished)
    values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '478.l.9', '478.l.9.t.1', 'No status', false)$$,
  '23502',
  null,
  'a direct insert must give a status'
);

select col_not_null('public', 'user_leagues', 'status', 'every league has a status');

select * from finish();
rollback;
