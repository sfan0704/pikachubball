# Fantasy Basketball AI Assistant

## Overview
An agentic chatbot application for Yahoo Fantasy Basketball analysis that helps users optimize their fantasy teams through AI-powered insights from multiple data sources.

## Project Goals
- Help users win their fantasy basketball season through intelligent recommendations
- Provide start/sit recommendations based on current stats and matchups
- Suggest waiver wire pickups using real-time data
- Analyze trade opportunities
- Identify team strengths and weaknesses

## Architecture

### Frontend (React + TypeScript)
- **Chat Interface**: Real-time conversation with AI assistant
- **Sidebar**: Team roster view, player stats cards, quick actions (drawer-style on mobile < 768px)
- **Rankings Page**: Dedicated page for 9-category master rankings analysis
- **Responsive Design**: Mobile-first approach with breakpoint at 768px (md:)
- **Theme Support**: Light/dark mode with system-based design
- **Components**: ChatMessage, ChatInput, PlayerStatCard, TeamRoster, QuickActions, ComparisonTable, YahooConnect, LeagueRankings

### Backend (Express + Node.js)
- **Yahoo OAuth 2.0**: Secure authentication with CSRF protection using state parameter
- **Token Management**: Automatic token refresh and invalidation handling
- **MCP Client**: Integration layer connecting to Yahoo Fantasy MCP server
- **API Routes**: Yahoo auth endpoints (/api/auth/yahoo/*) and data endpoints

### MCP (Model Context Protocol) Servers
Separate data layers following MCP architecture:

#### Yahoo Fantasy MCP Server (`mcp-servers/yahoo-fantasy/`)
- **Tools**:
  - `set_credentials`: Configure OAuth tokens
  - `get_user_leagues`: Fetch user's fantasy leagues
  - `get_league_standings`: Current league standings
  - `get_team_roster`: Team roster with player details
  - `get_league_scoreboard`: Weekly matchups and scores
  - `get_player_stats`: Player statistics
  - `get_free_agents`: Search available free agents

#### Planned MCP Servers
- BALLDONTLIE MCP Server: NBA player stats and game data
- Reddit MCP Server: r/fantasybaskeball discussions and insights
- YouTube MCP Server: Fantasy basketball podcast transcripts (Josh Lloyd, etc.)
- ESPN MCP Server: NBA news and analysis

## Recent Changes

### 2024-11-06: Mobile-Responsive Design Overhaul
**ENHANCEMENT**: Comprehensive mobile-first responsive design implementation
- **Sidebar**: Converts to slide-in drawer with backdrop on mobile (< 768px)
- **Rankings Table**: Horizontal scroll with sticky Rank/Team columns on mobile
- **Chat Interface**: Responsive text sizing, spacing, and touch-friendly buttons
- **Header**: Condensed layout on mobile (shortened title, hidden username on small screens)
- **Typography**: Scaled down on mobile (text-xs/sm) for better readability
- **Spacing**: Reduced padding and gaps on mobile throughout the app
- **Breakpoint**: Uses md: (768px) as primary breakpoint for mobile vs desktop layouts
- **Components Updated**: ChatPage, RankingsPage, LeagueRankings, ChatInput, ChatMessage, AuthPage

### 2024-11-06: 9-Category Master Rankings Page
**NEW FEATURE**: Dedicated rankings page showing true team strength across all categories
- **Rankings Page**: Full-page view at `/rankings` for analyzing league standings by 9 categories (FG%, FT%, 3PM, PTS, REB, AST, STL, BLK, TO)
- **Master Rank Algorithm**: Calculates overall team rank by averaging position across all 9 categories
- **Visual Hierarchy**: Color-coded rankings (green/yellow/red), text badges for top 3 teams, highlighted user team
- **API Endpoint**: `GET /api/yahoo/league-rankings/:leagueKey` fetches and calculates category ranks
- **Shared Types**: League, Player, and TeamRanking types defined in `shared/schema.ts` with Zod validation
- **Navigation**: Tooltip-accessible icon button in ChatPage header for easy access
- **Routing**: Uses wouter for all navigation, no direct history manipulation

### 2024-11-03: Multi-User Authentication with Per-User Yahoo Credentials
**MAJOR UPDATE**: Converted from single-user demo to full multi-tenant application
- **Database Migration**: Moved from in-memory storage to PostgreSQL with Drizzle ORM
- **Custom Authentication**: Implemented Passport.js local strategy with bcrypt password hashing
- **User Isolation**: Each user has their own encrypted Yahoo API credentials (no shared global credentials)
- **Encryption**: AES-256-GCM encryption for storing Yahoo Client ID/Secret securely
- **Session Management**: Express-session with configurable session secret
- **Protected Routes**: All Yahoo and settings routes require authentication
- **Frontend Auth**: Complete signup/login flow with react-hook-form and zod validation
- **Settings UI**: Modal dialog for users to manage their Yahoo API credentials
- **E2E Tested**: Verified multi-user isolation and complete authentication flow

### 2024-11-02: Yahoo Fantasy OAuth & MCP Implementation
- Implemented Yahoo Fantasy OAuth 2.0 with `fspt-w` scope for read/write access
- Added CSRF protection using cryptographic state parameter with 10-minute expiry
- Built token invalidation handling with automatic cleanup and re-authentication prompts
- Created Yahoo Fantasy MCP server with 7 tools for fantasy data access
- Developed MCP client integration layer (`server/mcp-client.ts`)
- Added YahooConnect component with reconnection affordances

### Security Features
- **Authentication**: Session-based auth with Passport.js and bcrypt (10 salt rounds)
- **Encryption**: AES-256-GCM with ENCRYPTION_KEY (required in production)
- **CSRF Protection**: State parameter validation for Yahoo OAuth
- **Credential Storage**: Per-user encrypted Yahoo credentials in PostgreSQL
- **Token Management**: Secure token storage with automatic refresh
- **Error Handling**: 401/403 handling with token cleanup and re-authentication prompts

## Data Sources
1. **Yahoo Fantasy API**: Team rosters, league data, matchups (via MCP)
2. **BALLDONTLIE API**: Free NBA stats (planned MCP server)
3. **Reddit**: r/fantasybaskeball discussions (planned MCP server)
4. **YouTube**: Podcast transcripts (planned MCP server)
5. **ESPN**: NBA news (planned MCP server)

## User Preferences
- Design: System-based modern design inspired by ChatGPT/Claude
- Typography: Inter for text, JetBrains Mono for stats
- Data: All non-parametric data must be in separate MCP servers (no hardcoding)
- APIs: Prefer free API endpoints over web scraping for reliability

## Key Files

**Frontend:**
- `client/src/App.tsx`: Main app with authentication routing
- `client/src/pages/AuthPage.tsx`: Login/Signup page
- `client/src/pages/ChatPage.tsx`: Main chat interface (protected route)
- `client/src/pages/RankingsPage.tsx`: 9-category master rankings page (protected route)
- `client/src/lib/auth.tsx`: Authentication context and hooks
- `client/src/components/SettingsDialog.tsx`: Yahoo credentials management UI
- `client/src/components/YahooConnect.tsx`: OAuth connection status and controls
- `client/src/components/LeagueRankings.tsx`: 9-cat rankings table with color-coded categories

**Backend:**
- `server/index.ts`: Express server with session and Passport initialization
- `server/auth.ts`: Passport.js configuration and password utilities
- `server/auth-routes.ts`: Authentication API endpoints and middleware
- `server/routes.ts`: Protected API routes (Yahoo OAuth, credentials, MCP)
- `server/yahoo-auth.ts`: Per-user OAuth flow and token management
- `server/encryption.ts`: AES-256-GCM encryption utilities
- `server/storage.ts`: PostgreSQL storage interface with Drizzle ORM
- `server/db.ts`: Database connection and Drizzle setup
- `server/mcp-client.ts`: MCP client integration layer

**MCP Servers:**
- `mcp-servers/yahoo-fantasy/`: Standalone Yahoo Fantasy MCP server

**Schema:**
- `shared/schema.ts`: Database models (users, yahooCredentials, yahooTokens) and API response types (League, Player, TeamRanking)

## Environment Variables
**Required in Production:**
- `DATABASE_URL`: PostgreSQL connection string (automatically provided by Replit)
- `ENCRYPTION_KEY`: 64-character hex key for encrypting user credentials (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `SESSION_SECRET`: Random string for session signing
- `ANTHROPIC_API_KEY`: Claude API key for AI responses

**User-Provided (via Settings UI):**
- Yahoo Client ID: Each user provides their own via Settings dialog
- Yahoo Client Secret: Each user provides their own via Settings dialog

**Note**: `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` environment variables are no longer used. Users provide their own credentials through the web interface.

## Development
- Port 5000: Combined Express + Vite server
- Workflow: `npm run dev` starts both backend and frontend
- Database: PostgreSQL with Drizzle ORM (use `npm run db:push` to sync schema)
- Migration: Never write manual SQL migrations - use `npm run db:push --force` if needed
