# Restore and rollback

## Roll back a bad deploy

Vercel keeps every deployment. In the Vercel dashboard, open the project's Deployments, pick the last good production deployment and choose **Instant Rollback** (or run `vercel rollback <deployment-url>`). Rollback changes only which deployment serves traffic; it does not touch the database.

Migrations are written to be backward compatible, so the previous app version works with the current schema. If a migration itself is the problem, write a new forward migration that fixes it; do not edit one that has already run.

## Recover lost data

Supabase Free has no backups, and the app is designed so none are needed:

| Lost | Recovery |
| --- | --- |
| Yahoo tokens | The user signs in again. |
| League list (`fantasy_memberships`) | Fetched again from Yahoo on the user's next visit. |
| Preferences | The user chooses their league again. |
| Whole database or project | Create a project, apply `supabase/migrations` in order (`supabase db push`), recreate the `yahoo` provider ([runbook](yahoo-sign-in-provider.md)), update `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, redeploy. Every user signs in again. |

The migrations are the source of truth for the schema. Nothing else in the database needs to be preserved.

## A paused project

A Free project pauses after a quiet week. Restore it from the Supabase dashboard (restoring a Card Benefits project requires pausing a basketball one first, because the organization has two Free slots).
