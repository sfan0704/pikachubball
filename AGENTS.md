# Contributing to Pikachu Basketball

These rules apply to everyone who changes this repository: people and coding agents alike. Claude Code reads them through `CLAUDE.md`; Codex, Cursor, Copilot and other agents read this file directly.

## Where things live

- **Design:** [`docs/target-state.md`](docs/target-state.md) is the agreed architecture. Parts of today's code predate it. New and changed code follows the target state; don't rewrite unrelated code in passing.
- **Work:** Linear holds every task. Each pull request belongs to a Linear issue.
- **Design changes** go in the same pull request as the code: update `docs/target-state.md` and its "As of" date, and add a line to [`docs/target-state-changelog.md`](docs/target-state-changelog.md).
- **Runbooks and reference** are in `docs/`. Keep them true in the same pull request that changes what they describe.

## Commands

```text
npm ci             # install (Node 24, npm 11)
npm run dev        # run locally
npm run lint       # ESLint, including the import-boundary and size rules
npm run format     # Prettier (format:check only checks)
npm run knip       # unused or unlisted packages and dead files
npm run check      # TypeScript
npm test           # unit and route tests (npm run test:coverage also enforces the coverage thresholds CI uses)
npm run build      # production build
npm run test:db    # database and access-rule tests (needs Docker)
```

Run `lint`, `format:check`, `knip`, `check` and `test` before opening a pull request, and `test:db` when you change anything in `supabase/`. Don't call a change done until they pass.

## Architecture rules

The target state has the detail; these are the rules most often broken.

- **Imports follow the layers.** `shared/domain` imports nothing. `shared/api` imports only `shared/domain` and zod. `server/fantasy` and `server/storage` never import HTTP code. The client never imports `server/`.
- **Yahoo stays behind `FantasyDataSource`** in `server/fantasy`. Every Yahoo response is validated with zod and turned into domain types there; nothing else sees Yahoo's format.
- **Fantasy maths is pure** functions in `shared/domain`: no I/O, no clock, no framework imports. It follows the Fantasy rules in the target state (competition ranks, makes over attempts, missing is not zero).
- **Dependencies are passed in.** Only the composition root reads configuration and constructs implementations. Classes take collaborators through the constructor; nothing creates its own Yahoo client or storage, imports configuration, or keeps state at module level.
- **Errors use the codes in `shared/api`.** Only `server/http` maps them to HTTP status.
- **The client fetches only through the API module and its hooks.** Components never call `fetch`. The URL holds the selected league, team and scope.

## Code rules

- TypeScript strict mode; no `any`. External data enters as `unknown` and passes a zod schema.
- No silent defaults for missing data, and no `catch` that hides a failure.
- Small, single-purpose functions (about 60 lines at most) and files (about 400 lines at most).
- Name things in the product's terms: league, scope, team table, category.
- No dead code, placeholders, commented-out code or debug endpoints.
- Comments explain why, not what. Every exported function and interface has a one-line doc comment.
- Log only at boundaries: one line per request and per Yahoo call. Never log tokens or Yahoo response bodies.

## Tests

- Every behaviour change has tests at the right layer (see Testing in the target state). A bug fix includes a test that fails without it.
- Tests are deterministic: fixed clock, no real network, no sleeps, no shared state.
- Never skip, retry or quarantine a failing test; fix the test or the code.
- Recorded Yahoo responses are scrubbed of names and personal details before they are committed.

## Data and security

- Yahoo access is read-only. Tests and automation never call the real Yahoo API.
- Never commit, print or log secrets, tokens or keys, and don't read `.env.local`. Never put credentials in fixtures, docs, Linear or pull requests.
- The server never uses the Supabase admin (service-role) key.
- Schema changes are new files in `supabase/migrations`, backward compatible with the running app, with access-rule tests in `supabase/tests`.

## Pull requests

- Small and single-purpose, on a branch named from the Linear issue.
- Title: `type: summary (ISSUE-ID)`, where type is `feat`, `fix`, `refactor`, `test`, `docs` or `chore`.
- The description says what changed, why, and how it was verified.
- Merged by squash once every check is green.
