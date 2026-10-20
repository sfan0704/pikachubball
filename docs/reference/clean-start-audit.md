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

## Run 2: resume by a different session

Pending: a separate session, with no chat history, resumes CAR-131 from this file, the Linear issue and the pull request, and records its result here.
