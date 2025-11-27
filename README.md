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
- **Yahoo Fantasy Account** with valid API credentials (Client ID & Secret)
- **OpenAI API Key** for chat functionality

## Quick Start

### 1. Clone & Install
```bash
git clone <repository>
npm install
```

### 2. Set Environment Variables
Create a `.env.local` file in the root with:
```bash
# Database (automatically provided on Replit)
DATABASE_URL=postgresql://...

# Session & Encryption (generate secure random strings)
SESSION_SECRET=your-secure-session-secret
ENCRYPTION_KEY=your-32-byte-hex-encryption-key

# Yahoo Fantasy OAuth (get from Yahoo Developer Portal)
YAHOO_CLIENT_ID=your-yahoo-client-id
YAHOO_CLIENT_SECRET=your-yahoo-client-secret
```

Note: Users provide their own OpenAI API keys through the app's settings page after authentication.

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
- `POST /api/auth/yahoo-oauth/start` - Initialize Yahoo OAuth flow
- `GET /api/auth/yahoo-oauth/callback` - OAuth callback endpoint

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
- All Yahoo and OpenAI credentials are encrypted with AES-256-GCM before storage
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

### Database connection errors
Verify `DATABASE_URL` is set and PostgreSQL is running:
```bash
npm run db:push  # Tests connection
```

### Yahoo OAuth fails
1. Verify `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` are correct
2. Check OAuth redirect URI matches Yahoo Developer Portal settings
3. Ensure user has a valid Yahoo account with Fantasy Basketball access

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

## Contributing

We follow best practices from:
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [React Official Docs](https://react.dev/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

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
- Check existing documentation in `replit.md`
- Review code comments and JSDoc headers for implementation details
