# Remote development contract

A worker starts with a repository, Linear issue ID, disposable compute and scoped access. The deliverable is a reviewed change with durable evidence. This contract applies to people and agents, independently of editor or personal configuration.

## Current support

Use Node 24, npm 11, the committed lockfile and Docker. The existing disposable stack works on a Docker-capable worker as it does locally: Supabase migrations, synthetic users and the Yahoo stand-in. It binds to loopback and rejects production and hosted service endpoints. Hosted credentials are unnecessary for implementation and tests. Do not read `.env.local`.

Each checkout gets its own Supabase stack and ports (CAR-125; see "Several workspaces" in the [README](../README.md)), so several workspaces can share a Docker host; `npm run workspace` shows a checkout's ports. The bounded Linux bootstrap is documented in [Disposable worker setup](agent-setup.md). Functional deployed previews are still tracked in CAR-128/CAR-129. A forwarded port is not permission to expose the synthetic login or database publicly.

Feature-branch Vercel previews are build checks only. The target hosted dev/release model is not fully active; see the [dated inventory](reference/infrastructure-inventory.md#environment-tiers). The owner's manual `npm run dev:hosted` HTTPS setup is a local-only exception for real Yahoo validation, never an automated fallback.

## Lifecycle

1. **Explore.** Read [AGENTS.md](../AGENTS.md), [target state](target-state.md), relevant runbooks and the working tree status. Record the source commit. Preserve unrelated changes; inspect implementation before assuming the target state is already deployed.
2. **Retrieve task.** Read the Linear issue, full description, discussion, dependencies and linked PRs. Check completion evidence as well as status. Identify acceptance criteria and unresolved decisions. Claim the issue and set In Progress when work begins. Missing task access is a blocker, not permission to invent its requirements.
3. **Bootstrap.** Use the pinned Ubuntu worker recipe and `npm run agent:setup` for bounded installation, migrations, seeds, build and smoke checks. See [setup prerequisites](agent-setup.md). Run `npm run dev` for the app and seed users. Browser validation additionally needs `npx playwright install --with-deps chromium`. Linux browser system packages require a provisioned image or explicit host administration access. Stop on missing prerequisites; never substitute hosted credentials. Record versions and setup failures without secrets.
4. **Implement.** Use the issue's branch name, make one bounded change and add behavior tests where appropriate. Keep design, runbooks and code consistent. An unresolved dependency permits investigation or a draft, not a claim of acceptance.
5. **Validate.** Run the checks below on the final change. Record command, result, commit and limitations. A missing prerequisite is a blocked check, never a pass. Re-run affected checks after changes.
6. **Deliver.** Push the issue branch and open a small PR using the repository title convention. Link the issue and describe behavior, tests, remaining blockers and design changes. Record the exact commit, PR URL, CI/evidence links and next action in the issue; use In Review only when the change is reviewable. Human review and release are separate from implementation.

## Validation

One command is the contract, for people, agents and CI alike:

```text
npm run validate                 # review: everything CI requires before a merge
npm run validate -- static unit  # named profiles: static, unit, build, database, browser
npm run validate -- iterate      # lint, types and tests while working; never enough for review
```

It prints which checks passed, failed, were unavailable or didn't run because a check they need failed, and exits nonzero unless every check passed. The database and browser profiles need Docker, and browser needs Chromium; without them those checks are `unavailable`, which fails the run. CI's three jobs run the same profiles (`static unit build`, `database`, `browser`). Before a release, also run `npm run load` against the stand-in. Never run automation against real Yahoo. For docs-only changes, do not invent browser evidence; record that no UI changed and rely on the required CI results.

## Authority and escalation

| Action | Worker authority |
| --- | --- |
| Read source, tasks, checks and redacted platform metadata | Proceed with available scoped access |
| Edit code/docs, install locked dependencies, test isolated disposable state | Proceed within the task and compute permissions |
| Push an issue branch, open/update its PR, record task evidence | Proceed; preserve unrelated work and existing checks |
| Missing credentials, platform permission, acceptance decision or failed prerequisite | Record the precise blocker and owner action; continue independent work |
| Provision hosted resources, change deployment/auth settings or expand trust boundaries | Prepare a concrete plan/diff; obtain the owner's decision before mutation |
| Production writes, credential rotation, migrations, destructive cleanup | Require explicit owner authorization and the documented runbook; preserve production approval gates |
| Merge, release or mark consequential rollout complete | Require owner authorization and verified acceptance; green tests alone are insufficient |

Do not grant yourself broader credentials or weaken checks to unblock work. Never copy production values into dev, tests, PRs or issues. Card Benefits infrastructure is outside scope. Default worker access ends at human review, without production write or merge authority.

## Handoff

Before stopping, leave the issue and PR sufficient for another worker: source and head commits, branch, changed behavior, checks with durable links, decisions, blockers and the next exact step. Keep secrets and private rows out of artifacts. If checks cannot run, leave a draft and report the limitation. Do not mark Done because a PR exists or a workflow file was merged; acceptance requires evidence of the promised outcome. The steps, status levels and record formats are in [Issue to review](issue-workflow.md).
