# Integration access

What access a worker, person or agent, needs for each kind of work, how it gets it, and where its authority stops. Run `npm run doctor` to see what the current environment has: it is read-only, prints no secrets, and says what to do about anything missing. The authority rules themselves are in the [remote development contract](remote-development.md#authority-and-escalation).

## Three tiers

| Tier | For | Credentials |
| --- | --- | --- |
| **Local** | Code, tests, `npm run validate`, the local stack | None. Docker, Node and npm only; the Yahoo stand-in replaces Yahoo |
| **Task** | Reading issues, pushing a branch, opening and updating a pull request, reading checks and deployment status | Scoped and read-mostly: Linear, GitHub write on this repository, optionally dev-only Supabase and read-only Vercel |
| **Privileged** | Production data or configuration, migrations on prod, secrets, releases, merging | The owner, or the approval-gated release workflow. Never on a normal worker |

Normal worker setup (`npm run agent:setup`) needs only the local tier. `npm run doctor` warns if a production-write secret (`SUPABASE_DB_PASSWORD`, `PRODUCTION_DEPLOY_KEY`, `ENCRYPTION_KEY`, `YAHOO_CLIENT_SECRET` and the like) is present, or if a token reaches the production database.

## Targets

Work must point at these identities; `npm run doctor` reports a **mismatch** otherwise.

| Integration | Identity |
| --- | --- |
| GitHub | `sfan0704/pikachubball` |
| Linear | team `CAR` (projects "Pikachu Basketball — …") |
| Supabase dev | `ocqdxmfpezxpgutoicyh` (Pikachu Basketball Development) |
| Supabase prod | `fpdwtpwpmxsbgjxizuxa` (Pikachu Basketball), privileged only |
| Vercel | project `prj_izIWbhRIRM77Kij7YoH8e8ciBkPT` in team `team_h0Yl4tlqpwkycY1Wl2ZppyOo` |

Card Benefits projects are out of scope for every tier.

## By operation

In each row, try the access paths in order: the agent's built-in connector, then the CLI, then the HTTP API with the named credential.

| Operation | Tier | Connector → CLI → API | Credential and scope | How it's supplied |
| --- | --- | --- | --- | --- |
| Read an issue, its comments and relations; comment; change its state | Task | Linear connector → none → GraphQL `api.linear.app` | `LINEAR_API_KEY`, a personal key with access to team CAR | The session's connector, or an environment variable |
| Push the issue branch; open or update its pull request | Task | GitHub connector → `gh` → REST `api.github.com` | `gh auth login`, or `GITHUB_TOKEN` with contents:write and pull_requests:write on this repository only | `gh` keychain, or an environment variable |
| Read checks and their logs | Task | GitHub connector → `gh pr checks`, `gh run view --log` → REST | As above, read is enough | As above |
| Deployment status of a commit (preview, dev, prod) | Task | `gh api repos/sfan0704/pikachubball/deployments` (Vercel reports to GitHub) → Vercel connector → REST `api.vercel.com` | GitHub access as above; no Vercel token needed | As above |
| Vercel runtime logs, project settings | Task (read) | Vercel connector → `vercel logs` → REST | `VERCEL_TOKEN` scoped to the team, read-only | Connector authorized for the team, or an environment variable |
| Dev database metadata, logs, advisors | Task (read) | Supabase connector → `supabase` CLI → management API | `SUPABASE_ACCESS_TOKEN` for an account that sees dev only | Connector, or an environment variable |
| Dev migrations | Task, through CI | The *Migrate dev* workflow (manual run from `main`) | `dev` GitHub environment secrets; the worker never holds them | GitHub environment |
| Production SQL, provider settings, secrets | Privileged | The owner, in the dashboard | Owner's account | Never given to a worker |
| Production migrations and releases | Privileged | The *Release* workflow, approved by the owner | `production` GitHub environment secrets | GitHub environment with required reviewers |
| Weekly keep-alive and schema dump | Automated | The *Scheduled* workflow | `maintenance` environment: a role that reads no rows | GitHub environment |

Hosted configuration comparison (provider, redirect allowlist, Vercel variables) belongs to CAR-100's config checks, and release activation to CAR-83's runbook; this page doesn't duplicate them.

`config:capture` can use a separate `CONFIG_VERCEL_TOKEN` with read access to the basketball project/team to acquire variable names and scopes directly, without decryption. It never grants deployment authority or enters app runtime configuration. A trusted connector projection is still supported when the worker has no token. See [configuration checks](runbooks/configuration-checks.md) for acquisition and redaction rules; workflow activation remains a separate, unverified checkpoint.

The [configuration-check runbook](runbooks/configuration-checks.md) defines the metadata-only input contract, safe database projections and migration-built schema reference. Auth configuration must come from a selective non-secret metadata source; the full Management API response is not an approved input. Vercel variable values are never requested or accepted. Missing acquisition capability remains a failed/unavailable check.

## When access is missing

A restricted worker still has a path for most things:

- **Task discussion:** without a Linear connector or key, ask the owner to paste the issue and its comments into the task, and say so in the handoff record. Never guess acceptance criteria.
- **Checks and CI logs:** `gh run view <id> --log-failed`, or the GitHub connector.
- **Deployment status:** GitHub's deployments API, which Vercel updates, needs no Vercel access.
- **Vercel runtime logs:** they need Vercel access. Without it, record "runtime logs unavailable" and what you needed them for. The owner can share the relevant lines.
- **Database state:** the local stack covers schema and behavior. Hosted dev state needs the Supabase connector or token; production state is the owner's.

`npm run doctor` turns each of these into a line: `ok`, `unavailable` with the action to take, `mismatch` when access points at the wrong repository or project, `warning` when it holds more than the task needs, or `failed` for a missing required tool. Only `failed` and `mismatch` make it exit nonzero; missing optional access is reported, not treated as a pass.
