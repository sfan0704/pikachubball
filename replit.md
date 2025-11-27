# Fantasy Basketball AI Assistant - Project Memory

**Status**: Active development | **Last Updated**: Nov 27, 2025

See `README.md` for user-facing documentation (features, setup, API reference, troubleshooting).

## Quick Overview

Multi-user AI chatbot for Yahoo Fantasy Basketball optimization. Users provide their own Yahoo + OpenAI credentials for complete privacy. Real-time league analytics (9-category rankings, matchup comparisons, simulator) powered by Yahoo Fantasy API. AI recommendations via OpenAI integration.

## User Preferences & Constraints

**Design & UX:**
- System-based modern design inspired by ChatGPT/Claude
- Typography: Inter for text, JetBrains Mono for stats
- Mobile-first responsive with light/dark mode support
- Drawer-style sidebar on mobile

**Architecture Constraints:**
- All non-parametric data must be in separate MCP servers (no hardcoding)
- Prefer free API endpoints over web scraping for reliability
- Each user provides their own Yahoo + OpenAI credentials (multi-tenant, privacy-first)
- Backend should be thin; put business logic in frontend where possible

**Code Quality:**
- 100% TypeScript with no `any` types
- Follow official best practices: Google TypeScript Style Guide, React Docs, Express best practices
- Use proper imports/exports: no circular dependencies, organized by feature
- All functions have explicit return types
- JSDoc headers on exported functions

## Architecture (High-Level)

```
Frontend (React) → Backend (Express) → PostgreSQL + MCP Server (Yahoo API)
                                    ↓
                          Credential Encryption (AES-256-GCM)
```

**Key Design Decisions:**
- **Layered architecture** for separation of concerns
- **Multi-tenant**: Each user's data is isolated and encrypted
- **MCP servers**: External data access via stdio-based Model Context Protocol (extensible for future APIs)
- **Credential encryption**: All Yahoo/OpenAI credentials encrypted with AES-256-GCM before storage

**Backend Organization** (modular by domain):
- `auth.ts` - Yahoo OAuth, user registration, credential management
- `yahoo.ts` - League data fetching, roster queries
- `viz.ts` - Rankings, matchup comparisons, simulator
- `chat.ts` - AI chat with OpenAI integration
- `index.ts` - Route orchestration

**Frontend Organization** (feature-based):
- `features/league/` - Rankings, matchups, schedule, simulator
- `features/chat/` - Chat interface
- `features/auth/` - OAuth, settings
- `common/` - Shared utilities
- `ui/` - shadcn/ui components

**Database** (Drizzle ORM + PostgreSQL):
- `users` - User accounts (bcrypt passwords)
- `yahooCredentials` - Encrypted Yahoo Client ID/Secret (per user)
- `yahooTokens` - OAuth tokens with auto-refresh
- `openaiCredentials` - Encrypted OpenAI API keys (per user)

## Recent Changes & Milestones

**Nov 27, 2025 - Refactoring Complete:**
- Backend: Split 932-line `routes.ts` into 5 modular domain files (~600 lines total)
- Frontend: Reorganized 17 flat components into feature-based directory structure
- Code Quality: Eliminated all `any` types, added JSDoc headers, improved naming
- ESLint + Prettier setup for code quality enforcement

**Completed Features:**
- Yahoo OAuth with automatic token refresh
- 9-category league rankings with sortable columns
- Weekly matchup comparisons (W/L/T with color-coded diffs)
- Matchup simulator (show team's W/L/T vs all opponents)
- AI chat interface with OpenAI integration
- User settings for credential management
- Light/dark mode support

## Coding Standards & Best Practices

This project adheres to official best practices from the libraries and frameworks used. Refer to these authoritative sources when making coding decisions.

### TypeScript Best Practices

**Official Resources:**
- Google TypeScript Style Guide: https://google.github.io/styleguide/tsguide.html
- TS.dev Style Guide: https://ts.dev/style/
- Microsoft TypeScript Coding Guidelines: https://github.com/microsoft/TypeScript/wiki/Coding-guidelines

**Key Rules:**
- Use `import type` for type-only imports (improves transpilation speed)
- Prefer `as` syntax for type assertions, not angle brackets `<Type>`
- Annotate function parameters and multi-line function return types explicitly
- Avoid `any` — create proper interfaces instead; never use `@ts-ignore`
- Array syntax: Use `User[]` not `Array<User>`
- Use semicolons, 2-space indentation, double quotes for consistency
- Naming: PascalCase for types/interfaces/classes, camelCase for functions/variables, UPPER_CASE for constants
- Document complex functions with JSDoc: `/** ... */` format

### React Best Practices

**Official Resources:**
- React Rules: https://react.dev/reference/rules
- Thinking in React: https://react.dev/learn/thinking-in-react
- React Official Docs: https://react.dev/

**Key Rules:**
- Use functional components with Hooks (modern standard)
- Hooks must be called at the top level only — never in loops, conditions, or nested functions
- Components must be pure: same input → same output, no side effects during render
- Side effects run outside of render (in useEffect)
- Single Responsibility: each component = one function/concern
- Extract reusable logic into custom hooks

### Express.js Best Practices

**Official Resources:**
- Performance Best Practices: https://expressjs.com/en/advanced/best-practice-performance.html
- Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices

**Key Rules:**
- Set `NODE_ENV=production` (critical for performance)
- Use `next()` for error propagation through middleware chain
- Always wrap async operations in try-catch
- Structure routes modularly: one routes file per domain
- Store secrets in `.env`, never hardcode API keys
- Use `const` over `let`/`var` for immutability

### Tailwind CSS Best Practices

**Official Resources:**
- Utility-First Fundamentals: https://tailwindcss.com/docs/styling-with-utility-classes
- Tailwind Config: https://tailwindcss.com/docs/configuration

**Key Rules:**
- Prefer React components over `@apply`
- Centralize design tokens in `tailwind.config.ts`
- Mobile-first: use breakpoint prefixes `sm:`, `md:`, `lg:` progressively
- Use arbitrary values sparingly
- Don't use string concatenation for dynamic classes: use `clsx`

## Critical Implementation Notes

**User Workflow:**
- Primary: Compare team stats vs opponent for current week to see W/L/T matchup score and category differences
- Design choice: Matchup tab uses table format with diff column color-coded green/red
- Design choice: FG and FT stats display as "makes/attempts (percentage)" format
- Design choice: Manager names display below team names in small gray text

**Backend Stat IDs** (VERIFIED):
- FG Makes/Attempts: 9004003
- FT Makes/Attempts: 9007006
- FG%: 5, FT%: 8, 3PM: 10
- PTS: 12, REB: 15, AST: 16
- STL: 17, BLK: 18, TO: 19

**Architecture Notes:**
- MCP server in `mcp-servers/yahoo-fantasy/` is a separate Node.js app spawned as child process
- Automatic token refresh via Yahoo OAuth
- Shared folder at root level follows monorepo pattern (equally accessible to client and server)
- Import aliases configured in `tsconfig.json` and `vite.config.ts`
