-- FAN-121: load_request_access answers the session check, the caller's Yahoo
-- identity, league ownership and encrypted tokens in one call, for the signed
-- caller only, and nothing at all for a session that has ended.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '23f99d06-30ff-4767-8c41-21510b7fd5d0', 'authenticated', 'authenticated', 'a@example.test', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd86688b2-0b07-4ddc-955b-655d600312ff', 'authenticated', 'authenticated', 'b@example.test', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '7c0b9a5e-4f43-4c1e-9b8d-2f6f0d6a1e11', 'authenticated', 'authenticated', 'c@example.test', '', now(), now());
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at) values
  ('guid-a', '23f99d06-30ff-4767-8c41-21510b7fd5d0', '{"sub":"guid-a","iss":"https://api.login.yahoo.com","name":"Manager A"}', 'custom:yahoo', now(), now()),
  ('guid-b', 'd86688b2-0b07-4ddc-955b-655d600312ff', '{"sub":"guid-b","iss":"https://api.login.yahoo.com"}', 'custom:yahoo', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('5161f00d-25bf-4cd8-92c6-0f3c325af11b', '23f99d06-30ff-4767-8c41-21510b7fd5d0', now(), now()),
  ('6272f11e-36c0-4de9-a3fd-1f4d436b022c', 'd86688b2-0b07-4ddc-955b-655d600312ff', now(), now()),
  ('8494a33f-58e2-4f0b-b5af-3a6f658d244e', '7c0b9a5e-4f43-4c1e-9b8d-2f6f0d6a1e11', now(), now());

insert into public.yahoo_connections (
  owner_id, yahoo_guid, display_name, email, access_token_ciphertext,
  refresh_token_ciphertext, token_expires_at, token_version, encryption_key_version
) values
  ('23f99d06-30ff-4767-8c41-21510b7fd5d0', 'guid-a', 'Manager A', null, 'v1.a.access', 'v1.a.refresh', 1800000000, 3, 1),
  ('d86688b2-0b07-4ddc-955b-655d600312ff', 'guid-b', null, null, 'v1.b.access', 'v1.b.refresh', 1800000000, 1, 1);
insert into public.user_leagues (owner_id, league_key, team_key, name, status) values
  ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '466.l.1', '466.l.1.t.1', 'League One', 'active'),
  ('d86688b2-0b07-4ddc-955b-655d600312ff', '466.l.2', '466.l.2.t.1', 'League Two', 'active');

select ok(not has_function_privilege('anon', 'public.load_request_access(text)', 'execute'), 'anon cannot call it');
select ok(not has_function_privilege('service_role', 'public.load_request_access(text)', 'execute'), 'service role cannot call it');
select ok(not has_function_privilege('maintenance', 'public.load_request_access(text)', 'execute'), 'maintenance cannot call it');
set local role anon;
select throws_ok($$select public.load_request_access(null)$$, '42501', null, 'anonymous RPC is denied');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0","session_id":"5161f00d-25bf-4cd8-92c6-0f3c325af11b"}', true);
select is(
  public.load_request_access('466.l.1'),
  jsonb_build_object(
    'active', true, 'yahoo_guid', 'guid-a', 'display_name', 'Manager A', 'owns_league', true,
    'connection', jsonb_build_object(
      'access_token_ciphertext', 'v1.a.access', 'refresh_token_ciphertext', 'v1.a.refresh',
      'token_expires_at', 1800000000, 'token_version', 3
    )
  ),
  'a live session gets its identity, its league and its own tokens in one call'
);
select is(public.load_request_access('466.l.2') ->> 'owns_league', 'false', 'another user''s league is not the caller''s');
select is(public.load_request_access('466.l.404') ->> 'owns_league', 'false', 'an unknown league is not the caller''s');
select ok(public.load_request_access(null) -> 'owns_league' = 'null'::jsonb, 'no league asked, no league answered');
select is(
  public.load_request_access(null) #>> '{connection,access_token_ciphertext}',
  'v1.a.access',
  'the tokens returned are the caller''s, never another user''s'
);

select set_config('request.jwt.claims', '{"sub":"d86688b2-0b07-4ddc-955b-655d600312ff","session_id":"5161f00d-25bf-4cd8-92c6-0f3c325af11b"}', true);
select is(public.load_request_access('466.l.1'), '{"active": false}'::jsonb, 'another user cannot use the session');

select set_config('request.jwt.claims', '{"sub":"7c0b9a5e-4f43-4c1e-9b8d-2f6f0d6a1e11","session_id":"8494a33f-58e2-4f0b-b5af-3a6f658d244e"}', true);
select ok(
  public.load_request_access(null) -> 'yahoo_guid' = 'null'::jsonb,
  'a live session with no Yahoo identity gets no Yahoo identity'
);

select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0"}', true);
select is(public.load_request_access('466.l.1'), '{"active": false}'::jsonb, 'absent session identifier fails closed');

-- A disconnected Yahoo account: the session is live, the tokens and leagues are gone.
select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0","session_id":"5161f00d-25bf-4cd8-92c6-0f3c325af11b"}', true);
select public.disconnect_yahoo();
select ok(public.load_request_access(null) -> 'connection' = 'null'::jsonb, 'a disconnected account has no tokens');
select is(public.load_request_access('466.l.1') ->> 'owns_league', 'false', 'a disconnected account has no leagues');

-- Logout deletes the session; copied claims for it get nothing back (CAR-132).
reset role;
delete from auth.sessions where id = '6272f11e-36c0-4de9-a3fd-1f4d436b022c';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d86688b2-0b07-4ddc-955b-655d600312ff","session_id":"6272f11e-36c0-4de9-a3fd-1f4d436b022c"}', true);
select is(public.load_request_access('466.l.2'), '{"active": false}'::jsonb, 'copied claims cannot revive a revoked session');
reset role;
select * from finish();
rollback;
