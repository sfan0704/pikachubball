# Migration feature boundary

The first deployed release keeps the original league analysis workflow while
leaving chat and scheduling outside the runtime. This keeps the migration small
and makes the Yahoo sign-in milestone independently verifiable.

## Retained

- Yahoo-only sign-in through Supabase custom OIDC
- League and week selection
- Category rankings and team matchup comparison
- Roster data and matchup simulator
- Theme and sign-out controls
- Existing controller, service, parser, shared-contract, and repository boundaries

## Excluded

- Chat UI, keyboard shortcuts, API routes, AI providers, and per-user AI keys
- NBA schedule tab, schedule controller, API route, and visualization service
- Local username/password authentication and session storage
- Direct Yahoo OAuth endpoints and process-wide token storage
- Replit-only development and deployment plugins
- Direct PostgreSQL and Drizzle runtime access

The Supabase migration creates only the owner-scoped Yahoo connection and
fantasy membership tables. It does not delete any legacy database or deployment.

## Regression checkpoint

The route-registry integration test verifies that the removed chat, schedule,
and AI credential endpoints return `404`. The rankings page test verifies the
retained theme and sign-out controls and the absence of chat and schedule UI.
Type checking, linting, the full test suite, and both standard and Vercel builds
must pass before this boundary is accepted.
