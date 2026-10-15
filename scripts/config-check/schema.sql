-- Only public catalog definitions; no user rows, tokens or provider secrets.
-- Exclude extension-owned objects, which the platform controls.
with relations as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
    coalesce((select jsonb_agg(a::text order by a::text) from unnest(c.relacl) a), '[]'::jsonb) as acl
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
    and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass
      and d.objid = c.oid and d.deptype = 'e')
), routines as (
  select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition,
    coalesce((select jsonb_agg(a::text order by a::text) from unnest(p.proacl) a), '[]'::jsonb) as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
      and d.objid = p.oid and d.deptype = 'e')
)
select encode(sha256(convert_to(jsonb_build_object(
  'relations', coalesce((select jsonb_agg(to_jsonb(r) - 'oid' order by r.relname) from relations r), '[]'::jsonb),
  'columns', coalesce((select jsonb_agg(jsonb_build_object(
    'table', r.relname, 'name', a.attname, 'position', a.attnum,
    'type', format_type(a.atttypid, a.atttypmod), 'notNull', a.attnotnull,
    'identity', a.attidentity, 'generated', a.attgenerated,
    'default', pg_get_expr(d.adbin, d.adrelid),
    'acl', coalesce((select jsonb_agg(x::text order by x::text) from unnest(a.attacl) x), '[]'::jsonb)
  ) order by r.relname, a.attnum) from relations r join pg_attribute a on a.attrelid = r.oid
    left join pg_attrdef d on d.adrelid = r.oid and d.adnum = a.attnum
    where a.attnum > 0 and not a.attisdropped), '[]'::jsonb),
  'constraints', coalesce((select jsonb_agg(jsonb_build_object(
    'table', r.relname, 'name', c.conname, 'definition', pg_get_constraintdef(c.oid), 'validated', c.convalidated
  ) order by r.relname, c.conname) from relations r join pg_constraint c on c.conrelid = r.oid), '[]'::jsonb),
  'indexes', coalesce((select jsonb_agg(jsonb_build_object(
    'table', r.relname, 'definition', pg_get_indexdef(i.indexrelid)
  ) order by r.relname, pg_get_indexdef(i.indexrelid)) from relations r join pg_index i on i.indrelid = r.oid), '[]'::jsonb),
  'policies', coalesce((select jsonb_agg(jsonb_build_object(
    'table', r.relname, 'name', p.polname, 'command', p.polcmd, 'permissive', p.polpermissive,
    'roles', (select jsonb_agg(case when roleid = 0 then 'public' else pg_get_userbyid(roleid) end
      order by case when roleid = 0 then 'public' else pg_get_userbyid(roleid) end) from unnest(p.polroles) roleid),
    'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid)
  ) order by r.relname, p.polname) from relations r join pg_policy p on p.polrelid = r.oid), '[]'::jsonb),
  'triggers', coalesce((select jsonb_agg(jsonb_build_object(
    'table', r.relname, 'name', t.tgname, 'enabled', t.tgenabled, 'definition', pg_get_triggerdef(t.oid)
  ) order by r.relname, t.tgname) from relations r join pg_trigger t on t.tgrelid = r.oid
    where not t.tgisinternal), '[]'::jsonb),
  'routines', coalesce((select jsonb_agg(to_jsonb(f) - 'oid' order by f.proname, f.arguments) from routines f), '[]'::jsonb),
  'views', coalesce((select jsonb_agg(jsonb_build_object(
    'name', r.relname, 'definition', pg_get_viewdef(r.oid)
  ) order by r.relname) from relations r where r.relkind in ('v', 'm')), '[]'::jsonb)
)::text, 'UTF8')), 'hex') as schema_digest;
