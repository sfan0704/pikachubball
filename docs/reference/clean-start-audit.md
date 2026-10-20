# Clean-start audit (CAR-131)

Whether a worker given only a Linear issue ID and this repository can take the issue to review, and whether a different session can pick the work up from the repository, Linear and the pull request alone. A missing capability is recorded as a gap, never as a pass.

## Run 1: issue to review, 2026-10-20

**Worker.** A new Claude Code cloud session in a fresh container, started 13:39 UTC. Its brief was one line, "Work Linear issue CAR-131 in https://github.com/sfan0704/pikachubball"; it had the Linear and GitHub connectors and no environment variables or secrets. Source commit `2f812f1e933822fb7f30717c91bca86172ee1d2a`.

| Step | Command or action | Time | Result |
| --- | --- | --- | --- |
| Session setup | SessionStart hook: `npm run session:setup` | automatic | Node 24.21.0 through nvm, npm 11.17.0, Docker started; reported Chromium missing and browser "left to CI" |
| Read the task | Linear issue, comments, relations; `docs/remote-development.md`, `docs/issue-workflow.md` | a few minutes | All blockers Done except CAR-133, whose remaining item is this audit |
| Claim | Linear: assign, In Progress, start record | seconds | Done |
| Doctor | `npm run doctor` | 1 s | OK to work; warnings below |
| Bootstrap | `npm run agent:setup` | 226 s | Passed: Chromium, build, migrations, seeds, health and synthetic sign-in |
| Full validation | `npm run validate` | 272 s | Passed every check: lint, format, knip, types, migrations, unit, build, bundle, database (86 s), browser (42 tests, 126 s) |
| Change | Session setup's summary now says `agent:setup` installs Chromium instead of sending browser to CI | | Commit `88cdf558423282aeb96c69a509c08ea10c1a4463`, with a unit test |
| Review environment | `npm run review:start`, `review:evidence`, `review:stop` | 33 s, 84 s | 42 of 42 flows passed at that commit; signed-in rankings screenshot inspected; stopped cleanly |
| Deliver | Branch, draft pull request, Linear review record, In Review | | See the issue's review record |

**Interventions.** None by a person during setup, validation or review.

**Gaps and deviations.**

- *Branch name.* The session's harness fixes the branch (`claude/project-thread-pb7jh1`), so it isn't Linear's `shihhaofan/car-131-…` name that AGENTS.md asks for. The pull request title and description carry the issue ID instead.
- *Context beyond the issue.* The hosting product gives each session a shared project memory with notes from earlier sessions. Every step above came from the repository and Linear, but this session was not strictly issue-ID-only; the resume run below is the stricter test.
- *Access wider than needed.* `npm run doctor` warns that the GitHub access is admin, where a worker needs only write. Linear is reachable only through the session's connector, not `LINEAR_API_KEY`.
- *Setup summary.* The one problem a fresh worker would act on: setup said the browser profile goes to CI, though `agent:setup` installs Chromium and the browser checks then pass here. Fixed in this run's change.

## Run 2: resume by a different session, 2026-10-20

**Worker.** A second Claude Code cloud session in a new container, started 13:59 UTC by a scheduled routine whose whole prompt was "Resume Linear issue CAR-131 in https://github.com/sfan0704/pikachubball". It had no chat history from run 1, the Linear and GitHub connectors, and no environment variables or secrets. It resumed at the pull request's head, `137ddf7d7dc17e383c03034c7c8b7905abe35353`, on base `2f812f1`.

| Step | Command or action | Time | Result |
| --- | --- | --- | --- |
| Session setup | SessionStart hook: `npm run session:setup` | automatic | Node 24.21.0, npm 11.17.0, Docker started; Chromium missing, and with run 1's change in place the summary would point at `agent:setup` |
| Pick up the work | Linear issue, its review record and earlier comments; pull request #127 (body, CI); this file; `docs/remote-development.md` | a few minutes | The review record named the head commit, the green checks and the exact next step; nothing had to be guessed or asked |
| Doctor | `npm run doctor` | 2 s | OK to work; same warnings as run 1 |
| Bootstrap | `npm run agent:setup` | 262 s | Passed: Chromium, build, migrations, seeds, health and synthetic sign-in |
| Full validation | `npm run validate` at the pull request's head | 274 s | Passed every check: lint, format, knip, types, migrations, unit, build, bundle, database (88 s), browser (42 tests, 122 s) |
| Change | This section | | Docs only; no UI changed, so no new browser evidence beyond the validate run and CI's review-environment job |
| Deliver | Branch, draft pull request, Linear review record | | See the issue's review record |

**Interventions.** None by a person.

**Gaps and deviations.**

- *Separate branch.* The harness gives each session its own branch (`claude/project-thread-aa9zy5`) and this session may push only to that one, so it could not add a commit to run 1's pull request. It branched from that pull request's head and opened a new pull request that carries both runs and replaces #127. A worker without that restriction would push to the existing branch.
- *Context beyond the issue.* As in run 1, the host injected the shared project memory, which mentions that CAR-131 awaited a resume run. Everything this session did came from the repository, Linear and the pull request.
- *Access wider than needed.* Unchanged from run 1: admin GitHub access, Linear through the connector only.

## Result

Every acceptance criterion was met in the two runs, with the deviations above: a fresh start from the issue ID, bootstrap and full validation in the session itself, a pull request with green CI and an In Review record that stopped before merge, and a resume by a different session from the repository, Linear and the pull request alone. No missing capability needed a follow-up issue.
