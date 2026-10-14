begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', 'authenticated', 'authenticated', 'session@example.test', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('5161f00d-25bf-4cd8-92c6-0f3c325af11b', '23f99d06-30ff-4767-8c41-21510b7fd5d0', now(), now());

select ok(not has_function_privilege('anon', 'public.is_current_session_active()', 'execute'), 'anon has no execution privilege');
select ok(not has_function_privilege('service_role', 'public.is_current_session_active()', 'execute'), 'service role has no execution privilege');
select ok(not has_function_privilege('maintenance', 'public.is_current_session_active()', 'execute'), 'maintenance has no execution privilege');
set local role anon;
select throws_ok($$select public.is_current_session_active()$$, '42501', null, 'anonymous RPC is denied');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0","session_id":"5161f00d-25bf-4cd8-92c6-0f3c325af11b"}', true);
select is(public.is_current_session_active(), true, 'caller owns an active session');
select set_config('request.jwt.claims', '{"sub":"d86688b2-0b07-4ddc-955b-655d600312ff","session_id":"5161f00d-25bf-4cd8-92c6-0f3c325af11b"}', true);
select is(public.is_current_session_active(), false, 'another owner cannot use the session');
select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0","session_id":"00000000-0000-0000-0000-000000000001"}', true);
select is(public.is_current_session_active(), false, 'missing session is rejected');
select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0","session_id":"malformed"}', true);
select is(public.is_current_session_active(), false, 'malformed session identifier fails closed');
select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0"}', true);
select is(public.is_current_session_active(), false, 'absent session identifier fails closed');
select set_config('request.jwt.claims', '{"session_id":"5161f00d-25bf-4cd8-92c6-0f3c325af11b"}', true);
select is(public.is_current_session_active(), false, 'absent caller fails closed');
reset role;
delete from auth.sessions where id = '5161f00d-25bf-4cd8-92c6-0f3c325af11b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"23f99d06-30ff-4767-8c41-21510b7fd5d0","session_id":"5161f00d-25bf-4cd8-92c6-0f3c325af11b"}', true);
select is(public.is_current_session_active(), false, 'copied claims cannot revive a deleted session');
reset role;
select * from finish();
rollback;
