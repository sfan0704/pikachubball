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
grant select on all tables in schema public to maintenance;
