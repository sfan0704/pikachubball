# Fantasy Basketball AI Assistant

An intelligent, multi-user AI chatbot designed to help optimize Yahoo Fantasy Basketball teams through data-driven recommendations, real-time league analysis, and conversational AI. Each user provides their own API credentials (Yahoo + OpenAI), ensuring complete privacy and cost control.

## Features

- **🏀 Real-Time League Analytics**
  - 9-category master rankings with sortable columns
  - Color-coded performance indicators (green = winning, red = losing)
  - Weekly matchup comparisons with detailed stat breakdowns
  - Matchup simulator showing W/L/T against all opponents
  - Team roster viewing with player status tracking

- **🤖 AI-Powered Recommendations**
  - Chat interface for start/sit decisions
  - Waiver pickup suggestions
  - Trade analysis based on league context
  - Integration with Yahoo Fantasy API for real-time data
  - Powered by OpenAI GPT (configurable via user credentials)

- **🔐 Multi-Tenant Architecture**
  - Per-user encrypted credential storage (AES-256-GCM)
  - Yahoo OAuth with automatic token refresh
  - Session-based authentication with Passport.js
  - Complete data isolation between users

- **📱 Responsive Design**
  - Mobile-first responsive layout
  - Light/dark mode support
  - Modern UI inspired by ChatGPT/Claude
  - Drawer-style sidebar on mobile

- **⚡ Modern Tech Stack**
  - React 18 with TypeScript for type safety
  - Vite for fast development and optimized builds
  - TanStack Query for server state management
  - shadcn/ui component library with Tailwind CSS
  - Drizzle ORM with PostgreSQL

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Routing**: wouter
- **State Management**: TanStack Query (React Query)
- **Forms**: react-hook-form + Zod validation
- **UI**: shadcn/ui + Tailwind CSS
- **Icons**: lucide-react

### Backend
- **Runtime**: Node.js + Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js + bcrypt
- **Encryption**: AES-256-GCM (crypto module)
- **External APIs**: Yahoo Fantasy API, OpenAI API

### Infrastructure
- **External Data**: Model Context Protocol (MCP) servers for isolated data access
- **Session Store**: PostgreSQL via connect-pg-simple
- **Build Tools**: esbuild, TypeScript

## Architecture

### System Design
```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Ranking Tab  │  │ Matchup Tab  │  │ Chat Interface   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│              Backend (Express.js + PostgreSQL)              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │  Auth  │ │ Yahoo  │ │ Viz    │ │ Chat   │ │Routes  │   │
│  │ Routes │ │ Routes │ │ Routes │ │ Routes │ │ Index  │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Storage Layer (Drizzle ORM + PostgreSQL)           │   │
│  │  - Users / Sessions / Credentials / Tokens         │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          ↓ Child Process (stdio-based)
┌─────────────────────────────────────────────────────────────┐
│          MCP Server (Yahoo Fantasy Integration)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Tools: leagues, standings, rosters, matchups,        │  │
│  │ player_stats, free_agents                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure
```
fantasy-basketball-ai/
├── client/                          # React frontend
│   └── src/
│       ├── components/
│       │   ├── features/
│       │   │   ├── league/         # Rankings, matchups, schedule
│       │   │   ├── chat/           # Chat interface
│       │   │   └── auth/           # Yahoo OAuth, settings
│       │   ├── common/             # Theme toggle, shared UI
│       │   └── ui/                 # shadcn components
│       ├── pages/                  # Route pages
│       ├── hooks/                  # Custom React hooks
│       ├── lib/                    # Utilities (auth, queryClient)
│       └── App.tsx                 # Main app component
├── server/                          # Express backend
│   ├── routes/
│   │   ├── auth.ts                # OAuth & credentials
│   │   ├── yahoo.ts               # Yahoo API wrapper
│   │   ├── viz.ts                 # Rankings & matchups
│   │   ├── chat.ts                # AI chat endpoint
│   │   └── index.ts               # Route registration
│   ├── storage.ts                 # Database interface
│   ├── auth.ts                    # Passport configuration
│   ├── db.ts                      # Drizzle setup
│   └── index.ts                   # Express app initialization
├── shared/                          # Shared types & schemas
│   └── schema.ts                  # Drizzle tables, Zod schemas
├── mcp-servers/
│   └── yahoo-fantasy/             # Yahoo Fantasy MCP server
│       ├── index.ts               # MCP server entry point
│       └── package.json
├── migrations/                      # Drizzle migrations (auto-generated)
├── vite.config.ts                 # Vite configuration
├── tailwind.config.ts             # Tailwind theming
├── tsconfig.json                  # TypeScript config with aliases
└── drizzle.config.ts              # Drizzle ORM config
```

## Prerequisites

- **Node.js** 18+ with npm
- **PostgreSQL** database (Replit provides this automatically)
- **Yahoo Developer App** - Create a Yahoo app at https://developer.yahoo.com/apps/ to get Client ID & Secret (app-level, shared by all users)
- **OpenAI API Key** - Users provide their own API keys through the app's settings page

## Quick Start

### 1. Clone & Install
```bash
git clone <repository>
npm install
```

### 2. Set Environment Variables
Create a `.env.local` file in the root with:
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fantasy_basketball

# Session & Encryption (generate secure random strings - see commands below)
SESSION_SECRET=your-secure-session-secret-min-32-chars
ENCRYPTION_KEY=your-64-hex-character-encryption-key

# Yahoo Fantasy OAuth (get from Yahoo Developer Portal)
# App-level credentials - used as default for all users
# Users can optionally provide their own credentials in Settings for rate limits/privacy
YAHOO_CLIENT_ID=your-yahoo-client-id
YAHOO_CLIENT_SECRET=your-yahoo-client-secret

# Optional: Custom redirect URI for development (required for ngrok/HTTPS testing)
# YAHOO_REDIRECT_URI=https://your-ngrok-subdomain.ngrok-free.dev/api/auth/yahoo/callback

# Optional: Trust proxy (set to "true" when behind ngrok, nginx, or other reverse proxy)
# TRUST_PROXY=true
```

**Generate secure secrets:**
```bash
# Generate SESSION_SECRET (32+ characters)
openssl rand -hex 32

# Generate ENCRYPTION_KEY (must be exactly 64 hex characters = 32 bytes)
openssl rand -hex 32
```

**Yahoo OAuth Credentials:**
- **Default (Recommended)**: App owner sets credentials in `.env.local`. All users share the same Yahoo app and just authorize via OAuth.
- **Optional**: Users can provide their own credentials in Settings → Advanced for:
  - Avoiding shared rate limits
  - Using their own Yahoo Developer app
  - Better privacy/security control
  - Enterprise/custom branding

**OpenAI API Keys:**
- Users provide their own OpenAI API keys through the app's settings page after authentication.

### 3. Setup Database
```bash
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```

The app will run on `http://localhost:5000` with:
- Frontend: Vite dev server
- Backend: Express API server
- Hot module reloading enabled

## Local Development with ngrok

Yahoo OAuth **requires HTTPS**, so you need ngrok (or similar) for local development.

### 1. Install ngrok
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 2. Start ngrok tunnel
```bash
ngrok http 5000
```

Note the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

### 3. Configure environment
Add to your `.env.local`:
```bash
YAHOO_REDIRECT_URI=https://abc123.ngrok-free.dev/api/auth/yahoo/callback
TRUST_PROXY=true
```

### 4. Update Yahoo Developer Portal
1. Go to https://developer.yahoo.com/apps/
2. Select your app
3. Add the ngrok URL to **Redirect URI(s)**: `https://abc123.ngrok-free.dev/api/auth/yahoo/callback`
4. Save changes

### 5. Restart the dev server
```bash
npm run dev
```

**Note:** The ngrok URL changes each time you restart ngrok (unless you have a paid plan). Update both `.env.local` and Yahoo Developer Portal when it changes.

## Production Deployment

### Build for Production
```bash
# Build frontend and backend
npm run build

# The build outputs:
# - dist/public/     (frontend static files)
# - dist/index.js    (backend server bundle)
```

### Production Environment Variables
```bash
# Required
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=<generate-with-openssl-rand-hex-32>
ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>

# Yahoo OAuth (app-level credentials)
YAHOO_CLIENT_ID=your-yahoo-client-id
YAHOO_CLIENT_SECRET=your-yahoo-client-secret

# Required: Your production domain's callback URL
YAHOO_REDIRECT_URI=https://your-domain.com/api/auth/yahoo/callback

# If behind a reverse proxy (nginx, load balancer, etc.)
TRUST_PROXY=true

# Optional: Custom port (default: 5000)
PORT=5000
```

### Run in Production
```bash
# Start the production server
npm start
```

### Deployment Checklist
- [ ] PostgreSQL database provisioned and `DATABASE_URL` set
- [ ] Generate new `SESSION_SECRET` and `ENCRYPTION_KEY` (don't reuse from dev)
- [ ] Yahoo Developer Portal: Add production redirect URI
- [ ] HTTPS configured (required for Yahoo OAuth)
- [ ] `TRUST_PROXY=true` if behind reverse proxy/load balancer
- [ ] Run `npm run db:push` to create database tables

### Reverse Proxy (nginx example)
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Replit Deployment

Replit provides automatic PostgreSQL and HTTPS, making deployment straightforward.

### 1. Import Repository
1. Go to [Replit](https://replit.com)
2. Click "Create Repl" → "Import from GitHub"
3. Paste your repository URL

### 2. Set Secrets (Environment Variables)
In Replit, go to **Tools → Secrets** and add:

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | Replit provides this automatically via PostgreSQL add-on |
| `SESSION_SECRET` | Generate: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` |
| `YAHOO_CLIENT_ID` | From Yahoo Developer Portal |
| `YAHOO_CLIENT_SECRET` | From Yahoo Developer Portal |

**Note:** `REPLIT_DEV_DOMAIN` is automatically set by Replit - you don't need to configure it.

### 3. Configure Yahoo Developer Portal
Add the Replit URL as a redirect URI in your Yahoo app:
```
https://your-repl-name.your-username.repl.co/api/auth/yahoo/callback
```

### 4. Add PostgreSQL
1. In Replit, click **Tools → Database**
2. Select **PostgreSQL**
3. Replit automatically sets `DATABASE_URL`

### 5. Deploy
```bash
# Push database schema
npm run db:push

# Start the app (Replit does this automatically)
npm run dev
```

### Replit-Specific Notes
- **HTTPS**: Replit provides HTTPS automatically - no configuration needed
- **Redirect URI**: Replit automatically detects `REPLIT_DEV_DOMAIN` for OAuth callbacks
- **Secrets**: Never commit secrets to git - use Replit's Secrets tool
- **Always-On**: Enable "Always On" in Replit for production use (requires paid plan)

## Development Guide

### Code Organization

**Backend Routes** (modular by domain):
- `server/routes/auth.ts` - Yahoo OAuth flows, user registration, credential management
- `server/routes/yahoo.ts` - League data fetching, roster management
- `server/routes/viz.ts` - Rankings, matchup comparisons, simulator logic
- `server/routes/chat.ts` - AI chat with OpenAI integration
- `server/routes/index.ts` - Route registration orchestrator

**Frontend Components** (feature-based):
- `components/features/league/` - RankingsTable, MatchupTab, MatchupSimulator, ScheduleTab
- `components/features/chat/` - ChatDialog, ChatMessages, ChatInput
- `components/features/auth/` - YahooOAuthButton, SettingsDialog
- `components/common/` - ThemeToggle, LoadingSpinner
- `components/ui/` - shadcn/ui library (Button, Card, etc.)

### Adding a New Feature

1. **Define types** in `shared/schema.ts`
   ```typescript
   export const myTable = pgTable("my_table", {
     id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
     // ... columns
   });
   ```

2. **Create backend route** in `server/routes/feature.ts`
   ```typescript
   app.get("/api/my-endpoint", async (req, res, next) => {
     try {
       // Validate input with Zod schema
       // Fetch/process data via storage interface
       res.json(result);
     } catch (error) {
       next(error);
     }
   });
   ```

3. **Register route** in `server/routes/index.ts`
   ```typescript
   import { featureRoutes } from "./feature";
   featureRoutes(app);
   ```

4. **Build frontend component** in `client/src/components/features/`
   ```typescript
   // Use TanStack Query for data fetching
   const { data, isLoading } = useQuery({
     queryKey: ["/api/my-endpoint"],
   });
   ```

### Code Quality

Run code quality checks:
```bash
npm run lint       # Check for code quality issues
npm run lint:fix   # Auto-fix eslint issues
npm run format     # Format code with Prettier
npm run check      # Type-check with TypeScript
```

### Database Migrations

All schema changes must be done through Drizzle:

1. Update `shared/schema.ts` with your changes
2. Push to database: `npm run db:push`
3. If data-loss warning: `npm run db:push --force`

Never manually write SQL migrations.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/logout` - Logout current session
- `GET /api/auth/me` - Get authenticated user info
- `GET /api/auth/yahoo` - Get Yahoo OAuth authorization URL
- `GET /api/auth/yahoo/callback` - OAuth callback endpoint
- `GET /api/auth/yahoo/status` - Get Yahoo connection status
- `DELETE /api/auth/yahoo` - Disconnect Yahoo account

### Yahoo Fantasy Data
- `GET /api/yahoo/leagues` - Get user's fantasy leagues
- `GET /api/yahoo/roster/:leagueKey` - Get team roster for a league
- `GET /api/yahoo/standings/:leagueKey` - Get league standings

### League Visualizations
- `GET /api/viz/rankings/:leagueKey` - Get 9-category rankings for a league
- `GET /api/viz/matchups/:leagueKey` - Get current week matchups
- `POST /api/viz/matchup-simulator` - Simulate matchup outcomes

### AI Chat
- `POST /api/chat` - Send message to AI assistant

All endpoints require authentication (session cookie).

## MCP Server: Yahoo Fantasy

The Yahoo Fantasy MCP server provides isolated access to Yahoo's Fantasy Basketball API.

**Available Tools:**
- `leagues` - Fetch user's leagues and team info
- `standings` - Get league standings and rankings
- `rosters` - Get team rosters with player details
- `matchups` - Get current/past matchup information
- `player_stats` - Fetch individual player statistics
- `free_agents` - Get available free agents in league

**Location:** `mcp-servers/yahoo-fantasy/`

**Startup:** The server is spawned as a child process when the backend starts. Communication is stdio-based per the MCP specification.

**Extension:** To add a new data source, create a new MCP server following the same pattern and register it in `server/index.ts`.

## Security

### Credential Encryption
- Yahoo OAuth credentials default to app-level (stored in environment variables, not encrypted)
- Users can optionally provide their own Yahoo credentials, which are encrypted with AES-256-GCM before storage
- OpenAI credentials are encrypted with AES-256-GCM before storage (per-user)
- Encryption key is derived from `ENCRYPTION_KEY` environment variable
- Encrypted values are stored in PostgreSQL; actual credentials never touch disk

### Authentication
- Passwords are hashed with bcrypt (10 rounds)
- Sessions stored in PostgreSQL with 7-day expiration
- Secure HttpOnly cookies prevent XSS attacks
- Yahoo OAuth includes CSRF protection via state parameter

### Token Management
- Yahoo access tokens are automatically refreshed when expired
- Refresh tokens are stored encrypted
- Token expiration tracked by Unix timestamp

## Troubleshooting

### "Session Secret not set" warning
Set `SESSION_SECRET` environment variable:
```bash
export SESSION_SECRET=$(openssl rand -hex 32)
```

### "ENCRYPTION_KEY must be exactly 64 hex characters"
Generate a valid encryption key:
```bash
# This generates exactly 64 hex characters (32 bytes)
openssl rand -hex 32
```

### Database connection errors
Verify `DATABASE_URL` is set and PostgreSQL is running:
```bash
npm run db:push  # Tests connection
```

### Yahoo OAuth fails
1. Verify `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` are set in `.env.local` (or user has provided their own in Settings)
2. **Check redirect URI matches EXACTLY** - The URI in Yahoo Developer Portal must match your environment:
   - Local with ngrok: `https://your-subdomain.ngrok-free.dev/api/auth/yahoo/callback`
   - Production: `https://your-domain.com/api/auth/yahoo/callback`
   - Replit: `https://your-repl.your-username.repl.co/api/auth/yahoo/callback`
3. **Set `YAHOO_REDIRECT_URI`** in `.env.local` to match the Yahoo Developer Portal
4. **Set `TRUST_PROXY=true`** if running behind ngrok/reverse proxy
5. Ensure user has a valid Yahoo account with Fantasy Basketball access
6. If using custom credentials, verify they're correct in Settings → Advanced

### Yahoo OAuth "redirect_uri mismatch" error
This means the redirect URI in your code doesn't match Yahoo Developer Portal:
1. Check the console logs for "Generating OAuth URL" to see what URI is being used
2. Copy that exact URI to Yahoo Developer Portal (including `/api/auth/yahoo/callback`)
3. Set `YAHOO_REDIRECT_URI` in `.env.local` to that exact value
4. Restart the server

### ngrok URL keeps changing
Free ngrok generates a new URL each session. Options:
1. Update `.env.local` and Yahoo Developer Portal each time
2. Use a paid ngrok plan for a stable subdomain
3. Use a different tunneling service with stable URLs

### Chat not responding
1. Verify user has provided an OpenAI API key in settings
2. Check OpenAI API is not rate-limited or experiencing outages
3. Review backend logs: `npm run dev` (check console output)

### Build errors
```bash
npm run check    # TypeScript type checking
npm run lint     # Code quality issues
npm run format   # Fix formatting issues
```

## Data Model

The application uses a layered type system to transform raw Yahoo API responses into clean, type-safe domain models.

### Architecture

**Three-Layer System:**

1. **Raw API Types** (`server/types/yahoo-api.ts`)
   - Exact structure of Yahoo API responses
   - Snake_case naming (matches Yahoo)
   - Infrastructure layer

2. **Domain Models** (`shared/domain/`)
   - Clean, normalized domain objects
   - CamelCase naming (TypeScript convention)
   - Used by both frontend and backend
   - Pure TypeScript interfaces (no runtime validation)

3. **DTOs** (`shared/schema.ts`)
   - Data Transfer Objects for frontend consumption
   - May combine/denormalize domain models
   - Zod validation schemas
   - Optimized for API responses

### Core Entities

**League**: Fantasy basketball league
- `leagueKey`, `name`, `season`, `currentWeek`, `endWeek`, `scoringType`, `numTeams`

**Team**: Fantasy team within a league
- `teamKey`, `teamName`, `leagueKey`, `managerName`, `managerGuid`

**Player**: NBA player (minimal for now)
- `playerKey`, `name`, `position`, `nbaTeam`, `status`

**Matchup**: Head-to-head matchup between two teams
- `leagueKey`, `week`, `team1Key`, `team2Key`, `team1Score`, `team2Score`, `status`

**TeamStats**: Statistical performance (team or player)
- `teamKey`, `scope` ('season' | 'week'), `week?`, `stats` (9 categories), computed `categoryRanks`, `totalRank`

### Relationships

- **League ↔ Team**: 1:N (Team has `leagueKey` foreign key)
- **Team ↔ Player**: M:N (via roster, not stored as separate entity)
- **League ↔ Matchup**: 1:N (Matchup has `leagueKey` foreign key)
- **Team ↔ Matchup**: M:2 (Matchup has `team1Key`, `team2Key`)
- **Team ↔ Stats**: 1:N (Stats has `teamKey` foreign key)

**Pattern**: Flat domain models with foreign key references. Nested relationships only in DTOs when needed.

### Parsing Strategy

**Location**: `server/services/parsers/`

**Functions**:
- `parseLeague()` - Transform Yahoo API league response → League
- `parseTeam()` - Transform Yahoo API team response → Team
- `parseTeamStats()` - Transform Yahoo API stats → TeamStats
- `parseMatchup()` - Transform Yahoo API scoreboard → Matchup[]
- `parsePlayer()` - Transform Yahoo API player response → Player

**Error Handling**: Parsers return `null` on invalid data. Services handle nulls and log warnings.

**Type Safety**: Parsers accept typed raw API responses, return typed domain models.

**Computed Fields**: Rankings and derived stats computed in separate functions (not in parsers).

### Time Granularity

Yahoo API supports **weekly** and **season** granularity (not daily):
- Season totals: Default (no week parameter)
- Weekly stats: `;type=week;week=${week}`
- Stats model: `scope: 'season' | 'week'` with optional `week` field

### File Structure

```
shared/
  domain/
    league.ts          # League, Team interfaces
    player.ts          # Player interface
    stats.ts           # TeamStats, CategoryStats interfaces
    matchup.ts         # Matchup interface
    index.ts           # Barrel exports (types only)

server/
  types/
    yahoo-api.ts       # Raw Yahoo API response types (snake_case)
  services/
    parsers/
      league-parser.ts # parseLeague(), parseTeam()
      stats-parser.ts  # parseTeamStats()
      matchup-parser.ts # parseMatchup()
      player-parser.ts # parsePlayer()

shared/
  schema.ts            # DTOs with Zod validation (enhanced)
```

## Contributing

We follow best practices from:
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [React Official Docs](https://react.dev/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- See `docs/EXPRESS_BEST_PRACTICES.md` for detailed code organization guidelines

### Development Workflow
1. Create a feature branch
2. Make changes following code organization patterns
3. Run `npm run format && npm run lint:fix`
4. Test locally with `npm run dev`
5. Submit PR with clear description

## License

MIT License - see LICENSE file for details

## Support & Feedback

For issues, suggestions, or questions:
- Open an issue on GitHub
- Check existing documentation in `docs/` folder
- Review code comments and JSDoc headers for implementation details

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Session encryption key (32+ chars) |
| `ENCRYPTION_KEY` | ✅ | AES encryption key (64 hex chars) |
| `YAHOO_CLIENT_ID` | ✅ | Yahoo app Client ID |
| `YAHOO_CLIENT_SECRET` | ✅ | Yahoo app Client Secret |
| `YAHOO_REDIRECT_URI` | ⚠️ | OAuth callback URL (required for ngrok/production) |
| `TRUST_PROXY` | ⚠️ | Set to `true` behind reverse proxy |
| `NODE_ENV` | ❌ | `development` / `production` / `test` |
| `PORT` | ❌ | Server port (default: 5000) |
| `REPLIT_DEV_DOMAIN` | ❌ | Auto-set by Replit |

⚠️ = Required in certain environments
