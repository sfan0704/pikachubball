# Express.js File Organization & Logic Separation Best Practices

This guide documents the file organization and logic separation patterns used in this codebase. Follow these principles to maintain consistency and code quality.

---

## 📁 Directory Structure

```
server/
├── config/              ← Application-level infrastructure setup
├── controllers/        ← HTTP request/response adapters
├── middleware/         ← Reusable Express middleware
├── routes/            ← Route definitions (URL → controller mapping)
├── services/          ← Reusable business logic (HTTP-agnostic)
├── utils/             ← Small, pure helper functions
├── storage.ts         ← Data access layer (repository pattern)
└── index.ts           ← Application entry point
```

---

## 1. `config/` - Infrastructure Configuration

**Purpose:** Application-level setup and configuration that initializes infrastructure.

**Characteristics:**
- ✅ Pure configuration/setup code
- ✅ No business logic
- ✅ Initializes libraries/frameworks (Passport, DB, Vite)
- ✅ Runs once at startup
- ✅ Infrastructure concerns only

**Examples in this codebase:**
- `config/env.ts` - Environment variable validation
- `config/auth.ts` - Passport.js setup
- `config/db.ts` - Database connection setup
- `config/vite.ts` - Vite dev server configuration

**Example:**
```typescript
// config/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "../storage";

passport.use(
  new LocalStrategy(async (username, password, done) => {
    // Authentication strategy configuration
  })
);

export { passport };
```

**Decision Rule:** Put here if it sets up infrastructure (Passport, DB, Vite, etc.)

---

## 2. `controllers/` - HTTP Adapter Layer

**Purpose:** Thin adapters between HTTP requests and business logic.

**Responsibilities:**
- Extract data from HTTP requests (`req.params`, `req.query`, `req.body`)
- Validate HTTP input
- Get dependencies from request context
- Call service functions
- Format HTTP responses (`res.json()`, status codes)
- Handle HTTP-specific concerns (sessions, cookies)

**Characteristics:**
- ✅ Always receives `req: Request, res: Response`
- ✅ Should be thin (delegate to services)
- ✅ HTTP-aware
- ❌ Not reusable outside HTTP context

**Example from this codebase:**
```typescript
// controllers/viz-controller.ts
export const vizController = {
  getLeagueRankings: asyncHandler(async (req: Request, res: Response) => {
    // 1. Extract from HTTP
    const { leagueKey } = req.params;
    const week = parseWeekParam(req.query.week);
    
    // 2. Get dependencies from request
    const userId = getAuthenticatedUserId(req);
    const dataSource = new YahooFantasyDataSource(userId);
    
    // 3. Call service (business logic)
    const response = await getLeagueRankings(dataSource, leagueKey, week);
    
    // 4. Return HTTP response
    res.json(response);
  })
}
```

**Anti-pattern to avoid:**
```typescript
// ❌ BAD: Business logic in controller
getLeagues: asyncHandler(async (req, res) => {
  // 50+ lines of parsing, transformation, business rules
  // This should be in a service!
})

// ✅ GOOD: Thin adapter
getLeagues: asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const leagues = await getUserLeagues(userId);  // Service call
  res.json({ leagues });
})
```

---

## 3. `services/` - Business Logic Layer

**Purpose:** Reusable business logic that implements domain concepts.

**Characteristics:**
- ✅ HTTP-agnostic (no `req`/`res`)
- ✅ Domain-specific business logic
- ✅ Testable in isolation
- ✅ Reusable (HTTP, CLI, background jobs)
- ✅ May have dependencies (storage, other services, external APIs)
- ✅ Complex operations with business rules

**Examples in this codebase:**
- `services/fantasy-data-source.ts` - Data source abstraction
- `services/viz/league-viz.ts` - League ranking calculations
- `services/viz/matchup-viz.ts` - Matchup comparison logic
- `services/viz/schedule-viz.ts` - Schedule matrix generation

**Example:**
```typescript
// services/viz/league-viz.ts
export async function getLeagueRankings(
  dataSource: FantasyDataSource,  // No HTTP dependencies!
  leagueKey: string,
  week?: number
): Promise<RankingsResponse> {
  // Pure business logic - could be called from anywhere
  // No req, no res, no HTTP concerns
  const settings = await dataSource.getLeagueSettings(leagueKey);
  const teamStats = await extractTeamStats(dataSource, leagueKey, week);
  
  // Complex ranking calculations
  const rankings = calculateRankings(teamStats);
  
  return { rankings, metadata };
}
```

**Decision Rule:** Put here if it's business logic that could be used outside HTTP context.

### 3.1. `services/parsers/` - API Response Parsing Layer

**Purpose:** Transform raw external API responses into domain models. This layer shields the rest of the application from API-specific quirks and format variations.

**Characteristics:**
- ✅ Handles all format variations from external APIs
- ✅ Returns clean domain models (not raw API types)
- ✅ Centralizes API structure parsing logic
- ✅ Makes services independent of API implementation details
- ✅ Easier to test and maintain

**Examples in this codebase:**
- `services/parsers/matchup-parser.ts` - Parse Yahoo API scoreboard/matchup responses
- `services/parsers/stats-parser.ts` - Parse Yahoo API stats responses
- `services/parsers/league-parser.ts` - Parse Yahoo API league responses
- `services/parsers/player-parser.ts` - Parse Yahoo API player responses

**Key Principle: Separation of Concerns**

**❌ BAD: Parsing logic in business services**
```typescript
// services/viz/matchup-viz.ts
export async function getMatchupComparison(...) {
  const scoreboard = await dataSource.getLeagueScoreboard(...);
  
  // ❌ BAD: Business service parsing Yahoo API structure directly
  const scoreboardSubresource = scoreboard?.fantasy_content?.league?.[1]?.scoreboard;
  let matchups: any = null;
  if (Array.isArray(scoreboardSubresource) && scoreboardSubresource.length > 0) {
    matchups = scoreboardSubresource[0]?.matchups;
  } else if (scoreboardSubresource && typeof scoreboardSubresource === 'object') {
    if (scoreboardSubresource['0']?.matchups) {
      matchups = scoreboardSubresource['0'].matchups;
    } else if (scoreboardSubresource.matchups) {
      matchups = scoreboardSubresource.matchups;
    }
  }
  // ... 50+ more lines of Yahoo API structure parsing
}
```

**✅ GOOD: Parsing logic in parsers, services use domain models**
```typescript
// services/parsers/matchup-parser.ts
export function extractTeamFromScoreboard(
  scoreboardData: YahooApiScoreboardResponse | null | undefined,
  teamKey: string,
  week: number
): YahooApiTeamData | null {
  // ✅ GOOD: All Yahoo API format variations handled here
  // Handles: array format, object with numeric keys, object with matchups property
  // Returns clean domain model
}

// services/viz/matchup-viz.ts
export async function getMatchupComparison(...) {
  const scoreboard = await dataSource.getLeagueScoreboard(...);
  
  // ✅ GOOD: Business service uses parser, works with domain models
  const myTeam = extractTeamFromScoreboard(scoreboard, teamKey, effectiveWeek);
  const opponent = extractTeamFromScoreboard(scoreboard, opponentTeamKey, effectiveWeek);
  
  // Business logic only - no API structure knowledge needed
}
```

**Why This Matters:**

1. **Shields Business Logic from API Quirks**
   - Yahoo API has inconsistent response structures (arrays vs objects, numeric string keys, etc.)
   - Parsers handle all variations in one place
   - Business services don't need to know about API implementation details

2. **Easier to Test**
   - Parsers can be tested independently with mock API responses
   - Business services can be tested with clean domain models
   - No need to mock complex API structures in business logic tests

3. **Easier to Maintain**
   - When API format changes, only parsers need updating
   - Business logic remains unchanged
   - Clear separation: parsers = API concerns, services = business concerns

4. **Better Reusability**
   - Parsers can be used by multiple services
   - Domain models are consistent across the application
   - Frontend receives clean, predictable data structures

**Decision Rule:** Put API response parsing logic in `services/parsers/`, not in business services. Business services should work with domain models, not raw API responses.

---

## 4. `utils/` - Helper Functions

**Purpose:** Small, reusable, stateless helper functions.

**Characteristics:**
- ✅ Small, pure functions
- ✅ Stateless (no side effects)
- ✅ Domain-agnostic (could be used in any project)
- ✅ Simple input/output transformations
- ✅ No business logic dependencies
- ✅ Reusable across the codebase

**Examples in this codebase:**
- `utils/week-parser.ts` - Parse and validate week parameter

**Example:**
```typescript
// utils/week-parser.ts
export function parseWeekParam(weekParam: unknown): number | undefined {
  if (!weekParam) return undefined;
  const parsed = parseInt(String(weekParam), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return parsed;
}
```

**Use cases:**
- String manipulation
- Number parsing/formatting
- Date formatting
- Validation helpers
- Generic transformations

**Decision Rule:** Put here if it's a small, pure, reusable helper function.

---

## 5. `middleware/` - Express Middleware

**Purpose:** Reusable Express middleware functions.

**Characteristics:**
- ✅ Express middleware signature: `(req, res, next) => void`
- ✅ Reusable across multiple routes
- ✅ Handles cross-cutting concerns
- ✅ May modify request/response
- ✅ Can be chained

**Examples in this codebase:**
- `middleware/auth.ts` - Authentication checks (`requireAuth`, `getAuthenticatedUserId`)
- `middleware/error-handler.ts` - Error handling middleware
- `middleware/rate-limiter.ts` - Rate limiting
- `middleware/yahoo-auth.ts` - Yahoo token validation
- `middleware/request-logger.ts` - Request logging

**Example:**
```typescript
// middleware/auth.ts
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ 
      error: "Authentication required",
      code: "UNAUTHORIZED"
    });
    return;
  }
  next();
}
```

---

## 6. `routes/` - Route Definitions

**Purpose:** Map HTTP endpoints to controllers.

**Characteristics:**
- ✅ Only route definitions
- ✅ No business logic
- ✅ Applies middleware
- ✅ Connects URLs to controller functions
- ✅ Should be minimal (5-20 lines per file)

**Example from this codebase:**
```typescript
// routes/viz.ts
export function registerVizRoutes(app: Express): void {
  app.get(
    "/api/viz/league-rankings/:leagueKey",
    requireAuth,
    requireYahooAuth,
    vizController.getLeagueRankings
  );
  
  app.get(
    "/api/viz/heatmap/:leagueKey",
    requireAuth,
    requireYahooAuth,
    vizController.getLeagueHeatmap
  );
}
```

---

## 7. Top-Level Files

**Purpose:** Core infrastructure files that don't fit other categories.

**Examples:**
- `index.ts` - Application entry point
- `storage.ts` - Data access layer (repository pattern)
- `encryption.ts` - Encryption utilities (could be `utils/`)

---

## 🔀 Decision Trees

### Where should this code go?

**Is it setting up infrastructure (Passport, DB, Vite)?**
- ✅ Yes → `config/`

**Is it an Express middleware function?**
- ✅ Yes → `middleware/`

**Does it handle HTTP requests/responses (`req`, `res`)?**
- ✅ Yes → `controllers/` (if it's a route handler)
- ✅ Yes → `routes/` (if it's just mapping URLs)

**Is it reusable business logic (no HTTP dependencies)?**
- ✅ Yes → `services/`

**Is it a small, pure helper function?**
- ✅ Yes → `utils/`

---

## 📐 Logic Separation Principles

### 1. Controllers Should Be Thin Adapters

```typescript
// ✅ GOOD: Thin controller
getLeagueRankings: asyncHandler(async (req, res) => {
  const { leagueKey } = req.params;
  const week = parseWeekParam(req.query.week);
  const dataSource = getDataSourceFromRequest(req);
  const result = await getLeagueRankings(dataSource, leagueKey, week);
  res.json(result);
})

// ❌ BAD: Fat controller with business logic
getLeagueRankings: asyncHandler(async (req, res) => {
  // 100+ lines of business logic here
  // Parsing, calculations, transformations
})
```

### 2. Services Should Be HTTP-Agnostic

```typescript
// ✅ GOOD: No HTTP dependencies
export async function getLeagueRankings(
  dataSource: FantasyDataSource,
  leagueKey: string,
  week?: number
): Promise<RankingsResponse>

// ❌ BAD: HTTP dependencies in service
export async function getLeagueRankings(
  req: Request,
  res: Response
): Promise<void>
```

### 3. Keep Concerns Separated

- **Config** = Infrastructure setup
- **Controllers** = HTTP adaptation
- **Services** = Business logic
- **Utils** = Helper functions
- **Middleware** = Cross-cutting concerns
- **Routes** = URL mapping

---

## 📋 File Organization Checklist

When creating a new file, ask:

1. **Does it set up infrastructure?** → `config/`
2. **Is it Express middleware?** → `middleware/`
3. **Does it handle HTTP requests?** → `controllers/` or `routes/`
4. **Is it reusable business logic?** → `services/`
5. **Is it a small helper function?** → `utils/`
6. **Is it core infrastructure?** → Top level

---

## 🔄 Common Patterns

### Pattern 1: Request Flow

```
HTTP Request
  ↓
routes/ (URL mapping)
  ↓
middleware/ (auth, validation)
  ↓
controllers/ (extract params, call service)
  ↓
services/ (business logic)
  ↓
storage/ (data access)
  ↓
Database
```

### Pattern 2: Service Reusability

Services can be called from:
- ✅ HTTP controllers
- ✅ CLI scripts
- ✅ Background jobs
- ✅ Tests
- ✅ Other services

### Pattern 3: Thin Controllers

```typescript
Controller = Extract + Validate + Call Service + Respond
```

---

## 📊 Summary Table

| Folder | Purpose | Key Characteristic |
|--------|---------|-------------------|
| `config/` | Infrastructure setup | Pure configuration, no business logic |
| `controllers/` | HTTP adapters | Thin, delegates to services |
| `services/` | Business logic | HTTP-agnostic, reusable |
| `services/parsers/` | API response parsing | Transforms raw API responses to domain models |
| `utils/` | Helper functions | Small, pure, stateless |
| `middleware/` | Express middleware | Reusable across routes |
| `routes/` | URL mapping | Minimal, just route definitions |

---

## 🎯 Key Principles

1. **Controllers adapt HTTP to services** - They should be thin adapters that extract HTTP data and call services.

2. **Services contain business logic** - They should be HTTP-agnostic and reusable.

3. **Parsers shield business logic from API quirks** - All external API response parsing should be in `services/parsers/`, not in business services.

4. **Keep concerns separated** - Each folder has a specific purpose. Don't mix concerns.

5. **Testability** - Services should be easily testable in isolation without HTTP dependencies.

6. **Reusability** - Business logic in services can be reused across different contexts (HTTP, CLI, jobs).

---

## 📚 Examples from This Codebase

### Good Example: Thin Controller + Service

**Controller (`controllers/viz-controller.ts`):**
```typescript
getLeagueRankings: asyncHandler(async (req: Request, res: Response) => {
  const { leagueKey } = req.params;
  const week = parseWeekParam(req.query.week);
  const userId = getAuthenticatedUserId(req);
  const dataSource = new YahooFantasyDataSource(userId);
  const response = await getLeagueRankings(dataSource, leagueKey, week);
  res.json(response);
})
```

**Service (`services/viz/league-viz.ts`):**
```typescript
export async function getLeagueRankings(
  dataSource: FantasyDataSource,
  leagueKey: string,
  week?: number
): Promise<RankingsResponse> {
  // Business logic here - no HTTP dependencies
}
```

### Good Example: Utility Function

**Utility (`utils/week-parser.ts`):**
```typescript
export function parseWeekParam(weekParam: unknown): number | undefined {
  // Small, pure, reusable helper
}
```

### Good Example: Middleware

**Middleware (`middleware/auth.ts`):**
```typescript
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Reusable authentication check
}
```

---

## ✅ Best Practices Summary

1. **Separate HTTP from business logic** - Controllers handle HTTP, services handle business logic.

2. **Keep controllers thin** - They should extract, validate, call services, and respond.

3. **Make services reusable** - No HTTP dependencies, testable in isolation.

4. **Shield business logic from API quirks** - Parsers handle all external API response parsing. Business services work with domain models, not raw API responses.

5. **Use utilities for helpers** - Small, pure functions go in `utils/`.

6. **Organize by concern** - Each folder has a specific purpose.

7. **Follow the request flow** - Routes → Middleware → Controllers → Services → Parsers → Data Source → External API.

---

---

## 8. Barrel Exports (index.ts) - TypeScript Best Practices

**Purpose:** Guidelines for when and how to use barrel exports (index.ts files) that re-export modules from a directory.

### When to Use Barrel Exports

**✅ Use Barrel Exports For:**
1. **Type-only modules** (interfaces, types) - No runtime code, no bundle impact
2. **Closely related modules** that are frequently imported together
3. **Public API boundaries** - Clear entry points for a module/package
4. **Small, cohesive directories** - 3-5 related files

**❌ Avoid Barrel Exports For:**
1. **Large directories** with many unrelated files
2. **Runtime code** when tree-shaking is critical - Direct imports are better
3. **Deep nesting** - Can cause circular dependency issues
4. **When explicit imports are clearer** - Better for understanding dependencies

### Best Practices

#### 1. Use Explicit Exports (Not `export *`)
```typescript
// ✅ GOOD: Explicit exports
export type { League, Team } from './league';
export { parseLeague, parseTeam } from './league-parser';

// ❌ BAD: Wildcard exports (harder to track, can export unintended things)
export * from './league';
export * from './league-parser';
```

#### 2. Type-Only Modules Are Safe
```typescript
// shared/domain/index.ts - Types only, no runtime impact
export type { League, Team } from './league';
export type { Player } from './player';
// ✅ Safe - types are erased at compile time
```

#### 3. Runtime Code - Be Selective
```typescript
// server/services/parsers/index.ts - Runtime code
export { parseLeague } from './league-parser';
export { parseTeamStats } from './stats-parser';
// ⚠️ Use only if these are frequently imported together
// Otherwise, direct imports are better for tree-shaking
```

### Project-Specific Guidelines

**Use Barrel Export For:**
- ✅ `shared/domain/index.ts` - Types only, used by both frontend and backend
  - Cleaner imports: `import type { League } from "@shared/domain"`
  - No bundle size impact (types are erased at compile time)

**Skip Barrel Export For:**
- ⚠️ `server/services/parsers/index.ts` - Use direct imports
  - Runtime code (affects bundle size)
  - Better for tree-shaking
  - More explicit dependencies: `import { parseLeague } from "../services/parsers/league-parser"`

**Rationale:**
- Domain types are used everywhere → barrel export provides real value
- Parsers are backend-only and may be imported selectively → direct imports are clearer
- Follows principle: "Use barrel exports when they provide clear value"

---

## 📝 File Naming Conventions

### Backend Files (server/)

**All backend files use kebab-case (lowercase with hyphens):**

- ✅ **Controllers**: `auth-controller.ts`, `chat-controller.ts`, `viz-controller.ts`, `yahoo-controller.ts`, `yahoo-oauth-controller.ts`
- ✅ **Middleware**: `error-handler.ts`, `rate-limiter.ts`, `request-logger.ts`, `yahoo-auth.ts`
- ✅ **Services**: `chat-service.ts`, `league-parser.ts`, `matchup-parser.ts`, `player-parser.ts`, `stats-parser.ts`, `fantasy-data-source.ts`
- ✅ **Utils**: `week-parser.ts`, `logger.ts`, `encryption.ts`
- ✅ **Routes**: `yahoo-oauth.ts`, `auth.ts`, `chat.ts`, `viz.ts`
- ✅ **Config**: `env.ts`, `auth.ts`, `db.ts`, `vite.ts`

**Rationale:**
- Improves readability (words clearly separated)
- Consistent with web development conventions
- Avoids case-sensitivity issues on some filesystems
- Matches URL naming patterns

### Frontend Files (client/)

**React Components - PascalCase:**
- ✅ `LoadingIndicator.tsx`
- ✅ `SettingsDialog.tsx`
- ✅ `AuthPage.tsx`
- ✅ `ChatMessage.tsx`
- ✅ `LeagueRankings.tsx`

**Rationale:** Matches React component naming convention and makes imports clear.

**Custom Hooks - camelCase:**
- ✅ `useMobile.ts` (or `.tsx` if contains JSX)
- ✅ `useFirstLeague.ts`
- ✅ `useToast.ts` (if custom, but `use-toast.ts` from shadcn/ui is acceptable)

**Rationale:** 
- **React/TypeScript standard** - camelCase matches the function name (`useMobile` → `useMobile.ts`)
- Matches React's hook naming convention
- Consistent with JavaScript/TypeScript conventions
- Use `.ts` unless the hook contains JSX (then use `.tsx`)

**Note:** 
- `use-toast.ts` is from **shadcn/ui** (which uses kebab-case for their components) - acceptable to keep as-is
- Custom hooks in this codebase now use camelCase (`useMobile.ts`, `useFirstLeague.ts`) following React standards

**Utilities & Helpers - camelCase:**
- ✅ `utils.ts`
- ✅ `queryClient.ts`
- ✅ `apiClient.ts`
- ✅ `formatDate.ts`

**Rationale:** Standard JavaScript/TypeScript convention for utility modules.

**Context Providers - camelCase:**
- ✅ `auth.tsx` (exports `AuthProvider` and `useAuth`)
- ✅ `chatContext.tsx` (more explicit alternative)
- ✅ `themeContext.tsx`

**Rationale:** Contexts are modules that export both a Provider component and a hook. Use camelCase to match the hook naming.

**Page Components - PascalCase:**
- ✅ `AuthPage.tsx`
- ✅ `ChatPage.tsx`
- ✅ `RankingsPage.tsx`

**Rationale:** Pages are React components, so they follow component naming.

**UI Library Components (shadcn/ui) - kebab-case:**
- ✅ `accordion.tsx`
- ✅ `alert-dialog.tsx`
- ✅ `button.tsx`

**Rationale:** Many UI component libraries (like shadcn/ui) use kebab-case. This is acceptable for consistency with the library's conventions. Custom UI components should use PascalCase.

**Type Definitions - camelCase:**
- ✅ `types.ts` (general types)
- ✅ `apiTypes.ts` (API-specific types)
- ✅ `leagueTypes.ts` (domain-specific types)

**Test Files - `*.test.ts` or `*.test.tsx`:**
- ✅ `LoadingIndicator.test.tsx`
- ✅ `useMobile.test.ts`
- ✅ `utils.test.ts`

### Current Status ✅

**All files are now consistent:**
- ✅ `useMobile.ts` (camelCase) - Custom hook following React standards
- ✅ `useFirstLeague.ts` (camelCase) - Custom hook following React standards
- ✅ `use-toast.ts` (kebab-case) - From shadcn/ui, acceptable to keep as-is
- ✅ `chatContext.tsx` (camelCase) - Context file following conventions
- ✅ `auth.tsx` (camelCase) - Context file following conventions

**Why camelCase for custom hooks?**
- It's the **React/TypeScript standard** for hooks
- Matches the function name (`useMobile` → `useMobile.ts`)
- More consistent with JavaScript/TypeScript conventions
- UI library conventions (kebab-case) don't need to apply to custom hooks

### Summary Table

| File Type | Backend Convention | Frontend Convention | Example |
|-----------|-------------------|---------------------|---------|
| Components | N/A | PascalCase | `LoadingIndicator.tsx` |
| Hooks | N/A | camelCase | `useMobile.ts` (React standard) |
| Utilities | kebab-case | camelCase | `week-parser.ts` / `utils.ts` |
| Contexts | N/A | camelCase | `auth.tsx` or `authContext.tsx` |
| Controllers | kebab-case | N/A | `auth-controller.ts` |
| Services | kebab-case | N/A | `chat-service.ts` |
| Middleware | kebab-case | N/A | `error-handler.ts` |
| Routes | kebab-case | N/A | `auth.ts` |
| Pages | N/A | PascalCase | `AuthPage.tsx` |
| UI Library | N/A | kebab-case | `button.tsx` (shadcn/ui convention) |
| Tests | `*.test.ts` | `*.test.ts(x)` | `LoadingIndicator.test.tsx` |

---

This guide should be referenced when adding new code or refactoring existing code to ensure consistency across the codebase.

