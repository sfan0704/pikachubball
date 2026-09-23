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

set local role authenticated;
select set_config('request.jwt.claim.sub', '23f99d06-30ff-4767-8c41-21510b7fd5d0', true);

select is(
  public.upsert_yahoo_connection(
    'guid-a', 'Manager A', 'a@example.test', 'v1.a.access.tag',
    'v1.a.refresh.tag', 1800000000::bigint, 1::smallint
  ),
  1::bigint,
  'owner A can insert its connection through the authenticated RPC'
);

select lives_ok(
  $$select public.replace_fantasy_memberships('[{"league_key":"466.l.1","team_key":"466.l.1.t.1"}]'::jsonb)$$,
  'owner A can replace its memberships'
);

select results_eq(
  $$select yahoo_guid from public.yahoo_connections$$,
  $$values ('guid-a'::text)$$,
  'owner A can read its connection'
);

select results_eq(
  $$select league_key from public.fantasy_memberships$$,
  $$values ('466.l.1'::text)$$,
  'owner A can read its membership'
);

select set_config('request.jwt.claim.sub', 'd86688b2-0b07-4ddc-955b-655d600312ff', true);

select is_empty(
  $$select owner_id from public.yahoo_connections$$,
  'owner B cannot read owner A connection'
);

select is_empty(
  $$select owner_id from public.fantasy_memberships$$,
  'owner B cannot read owner A membership'
);

select throws_ok(
  $$insert into public.fantasy_memberships(owner_id, league_key, team_key)
    values ('23f99d06-30ff-4767-8c41-21510b7fd5d0', '466.l.2', '466.l.2.t.2')$$,
  '42501',
  null,
  'owner B cannot insert a membership for owner A'
);

select is_empty(
  $$update public.yahoo_connections set display_name = 'forged'
    where owner_id = '23f99d06-30ff-4767-8c41-21510b7fd5d0'
    returning owner_id$$,
  'an update cannot affect an invisible foreign connection'
);

select throws_ok(
  $$select public.upsert_yahoo_connection(
    'guid-a', 'Manager B', 'b@example.test', 'v1.b.access.tag',
    'v1.b.refresh.tag', 1800000000::bigint, 1::smallint
  )$$,
  '42501',
  null,
  'owner B cannot connect with owner A''s Yahoo GUID'
);

select throws_ok(
  $$select public.upsert_yahoo_connection(
    'guid-unclaimed', 'Manager B', 'b@example.test', 'v1.b.access.tag',
    'v1.b.refresh.tag', 1800000000::bigint, 1::smallint
  )$$,
  '42501',
  null,
  'owner B cannot connect with a GUID that is not its verified identity'
);

select is(
  public.upsert_yahoo_connection(
    'guid-b', 'Manager B', 'b@example.test', 'v1.b.access.tag',
    'v1.b.refresh.tag', 1800000000::bigint, 1::smallint
  ),
  1::bigint,
  'owner B can insert a separate connection'
);

select throws_ok(
  $$update public.yahoo_connections set yahoo_guid = 'guid-a'
    where owner_id = 'd86688b2-0b07-4ddc-955b-655d600312ff'$$,
  '42501',
  null,
  'owner B cannot rewrite its row to owner A''s Yahoo GUID'
);

select ok(
  public.rotate_yahoo_tokens(1::bigint, 'v1.b.access2.tag', 'v1.b.refresh2.tag', 1800003600::bigint, 1::smallint),
  'current token version rotates atomically'
);

select isnt(
  public.rotate_yahoo_tokens(1::bigint, 'stale-access', 'stale-refresh', 1800007200::bigint, 1::smallint),
  true,
  'stale token version cannot overwrite the committed rotation'
);

reset role;
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '5b0c2f3e-8d7a-4f1e-9c2b-3a4d5e6f7a8b', 'authenticated', 'authenticated', 'c@example.test', '', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '5b0c2f3e-8d7a-4f1e-9c2b-3a4d5e6f7a8b', true);

select throws_ok(
  $$select public.upsert_yahoo_connection(
    'guid-c', 'Manager C', 'c@example.test', 'v1.c.access.tag',
    'v1.c.refresh.tag', 1800000000::bigint, 1::smallint
  )$$,
  '42501',
  null,
  'a user without a verified Yahoo identity cannot connect'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select throws_ok(
  $$select owner_id from public.yahoo_connections$$,
  '42501',
  null,
  'anonymous requests cannot read connections'
);

select * from finish();
rollback;
