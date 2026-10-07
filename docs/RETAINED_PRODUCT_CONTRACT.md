# Retained product contract

This file records the product and architecture baseline for the 2026–27 revival.
It prevents hosting and authentication work from silently becoming a framework or
product rewrite.

## Retained user flows

- Sign in with Yahoo and sign out.
- Discover and select an accessible Yahoo fantasy basketball league.
- Switch between season and weekly ranking scopes.
- View league rankings and category heatmaps.
- Compare the current matchup and compare the selected team against every team.
- View the selected team's roster.
- Use the existing responsive layout and light/dark theme.

Chat, AI-key management, and NBA scheduling are intentionally excluded from the
revival release. Fantasy week selection and Yahoo matchup periods remain in scope.

## Retained HTTP surface

- Authentication status, Yahoo sign-in callback, and logout.
- Yahoo league discovery and roster reads.
- Rankings, heatmap, matchup comparison, and all-opponent comparison reads.
- A deployment health endpoint.

Exact route names may change only when required by the Supabase authentication or
Vercel deployment boundary. Existing client calls and response contracts should be
preserved where practical and any intentional contract change must have a focused
regression test.

## Retained architecture

- React, Vite, wouter, and TanStack Query on the client.
- Express routes and thin controllers on the server.
- HTTP-independent services for business logic.
- `FantasyDataSource` as the Yahoo provider boundary.
- Repository interfaces as the persistence boundary.
- Pure shared domain types and calculations.
- Feature-organized components and the existing naming conventions.

The application is not migrating to Next.js. Hosting changes must not move business
logic into routes, middleware, or React components.

## Baseline verification

The supported development and CI runtime is Node.js 24 with npm 11, pinned by
`.nvmrc`, `package.json`, and the GitHub Actions workflow. From a clean checkout:

```sh
npm ci
npm run lint
npm run check
npm test
npm run build
```

All commands must pass before a change can claim a regression-free baseline.
