# Production reset

Use it when production's database must start over from the migrations: once, for the clean start onto the baseline migration (CAR-138, run in CAR-139), and again only if the [deploy drift check](release.md#day-to-day) finds drift nobody can explain while production still has no users to lose. It is irreversible: every stored Yahoo connection, league list and preference is deleted. Supabase sign-in users (`auth.users`) stay, so nobody needs a new account, but everyone connects Yahoo again on their next sign-in. Only the owner runs it, and only after deciding to.

The reset happens in place, in project `fpdwtpwpmxsbgjxizuxa`. Everything outside the app's own schema stays as it is: the project URL and keys, the `custom:yahoo` provider and its secret, the Site URL and redirect allowlist, the Vercel Production variables, and the `maintenance` role with its password.

## Before

1. Merge the change the deploy will apply, and check CI is green on `main`. Leave `RELEASE_AUTOMATION` unset until the reset is done, so the merge doesn't deploy yet.
2. Check nobody is using production: in the SQL editor, `select count(*) from public.yahoo_connections;` should be only your own test connections. If real managers are connected, stop and decide again.
3. Download the latest `production-schema` artifact from the *Scheduled* workflow, or dump the schema yourself, so you can compare afterwards.

## Do

In the production project's SQL editor, run this as one statement batch. It removes only what the app's migrations created, plus the migration history, and leaves the platform's own objects in `public` (such as `rls_auto_enable`) alone:

```sql
begin;
drop table if exists
  public.yahoo_connections,
  public.fantasy_memberships,
  public.user_leagues,
  public.user_preferences
  cascade;
drop function if exists
  public.enforce_verified_yahoo_guid(),
  public.touch_updated_at(),
  public.upsert_yahoo_connection(text, text, text, text, text, bigint, smallint),
  public.rotate_yahoo_tokens(bigint, text, text, bigint, smallint),
  public.replace_fantasy_memberships(jsonb),
  public.replace_user_leagues(jsonb),
  public.disconnect_yahoo(),
  public.delete_my_account(),
  public.is_current_session_active();
delete from supabase_migrations.schema_migrations;
commit;
```

Then check that nothing of the app's is left. This should return no rows; if it lists anything, find out where it came from before going on:

```sql
select 'relation' as kind, c.relname as name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
union all
select 'function', p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prorettype <> 'event_trigger'::regtype
  and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
    and d.objid = p.oid and d.deptype = 'e');
```

Rebuild it through the normal deploy: set `RELEASE_AUTOMATION` to `true`, then Actions → CI, open the latest run for `main`'s newest commit and choose **Re-run all jobs**. When it passes, it starts a fresh *Deploy* run with the current secrets; re-running an old *Deploy* run can keep a database password the reset preparation replaced. The [release runbook](release.md) has the one-time setup it needs. The drift check sees an empty history and an empty schema, matches them against a replay of no migrations, and passes; the migrate step then applies the baseline and everything after it.

## Check

- The deploy's drift check passed, *Apply the migrations* applied `20261019000000_baseline.sql`, and the smoke check passed.
- In the SQL editor, `select version from supabase_migrations.schema_migrations order by version;` lists exactly the files in `supabase/migrations`.
- Sign in to production with Yahoo and follow the [verification checkpoint](../reference/authentication.md#verification-checkpoint): sign-in, league list, a protected route, sign-out.
- Run Actions → Scheduled → Run workflow once: the `maintenance` role can still sign in and dump the new schema.
- Merge a change with no new migration, or re-run CI on `main`'s newest commit to start a fresh deploy: its drift check must pass. A mismatch now means the hosted database differs from the local replay in a way the check doesn't yet ignore; record it on the issue before changing anything.
