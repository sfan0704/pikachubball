# Fantasy Basketball AI Assistant

## What You've Built

A **multi-user AI chatbot application** that helps users win their Yahoo Fantasy Basketball leagues through intelligent, data-driven recommendations. Each user provides their own API credentials (Yahoo + OpenAI), ensuring complete privacy and cost control.

### Core Features

**1. AI-Powered Chat Assistant**
- Conversational interface powered by OpenAI GPT-5
- Direct access to user's Yahoo Fantasy data through function calling
- 6 integrated tools: leagues, standings, rosters, matchups, player stats, free agents
- Intelligent recommendations for start/sit decisions, waiver pickups, and trade analysis

**2. 9-Category Master Rankings**
- Dedicated `/rankings` page analyzing team strength across all fantasy categories
- Sortable columns: FG%, FT%, 3PM, PTS, REB, AST, STL, BLK, TO
- Color-coded performance indicators (green/yellow/red gradients)
- Master rank calculated by averaging position across all 9 categories
- Mobile-responsive with horizontal scroll and sticky columns

**3. Multi-User System**
- Secure account creation with username/password authentication
- Complete data isolation between users
- Session-based authentication with Passport.js
- Per-user encrypted credential storage (Yahoo + OpenAI)

**4. User-Provided Credentials (Zero Developer Costs!)**
- Each user provides their own Yahoo API credentials (Client ID/Secret)
- Each user provides their own OpenAI API key
- AES-256-GCM encryption for all credentials
- No shared API keys or secrets
- Users pay for their own OpenAI usage

**5. Mobile-First Responsive Design**
- Drawer-style sidebar on mobile (< 768px breakpoint)
- Touch-friendly interfaces throughout
- Responsive typography and spacing
- Works seamlessly on phones, tablets, and desktop

## Overview

This project is a multi-user AI chatbot application designed to help users optimize their Yahoo Fantasy Basketball teams. It provides intelligent, data-driven recommendations for start/sit decisions, waiver pickups, and trade analysis through an AI-powered conversational interface.

The application leverages AI-powered insights from multiple data sources, including real-time Yahoo Fantasy data. Each user provides their own API credentials (Yahoo + OpenAI), ensuring complete privacy and cost control.

The project's ambition is to create a powerful, personalized, and private AI assistant for fantasy sports, with potential for broader market application in data-driven decision-making tools.

## How It Works

### User Journey

**1. Account Creation**
- User visits the application and creates an account with username/password
- Credentials are hashed with bcrypt before storage
- Session established with secure cookie

**2. Credential Setup**
- User navigates to Settings dialog
- Enters Yahoo API credentials (Client ID + Client Secret)
- Enters OpenAI API key
- All credentials encrypted with AES-256-GCM before database storage
- System validates credentials by making test API calls

**3. Yahoo OAuth Flow**
- User clicks "Connect to Yahoo" in Settings
- Backend generates OAuth URL with state parameter for CSRF protection
- User redirects to Yahoo, grants permissions
- Yahoo redirects back with authorization code
- Backend exchanges code for access/refresh tokens
- Tokens encrypted and stored in database
- Auto-refresh mechanism keeps tokens valid

**4. Chat Interaction**
- User asks questions in the chat interface
- Frontend sends message to `/api/chat` endpoint
- Backend:
  - Retrieves user's decrypted OpenAI API key
  - Initializes MCP client with user's decrypted Yahoo credentials
  - Creates OpenAI GPT-5 client with user's API key
  - Sends message to OpenAI with available MCP tools
  - OpenAI decides which tools to call (if any)
  - Backend executes MCP tool calls and returns data to OpenAI
  - OpenAI generates final response
  - Response streamed back to frontend via Server-Sent Events

**5. Rankings Page**
- User navigates to `/rankings` page
- Frontend fetches data from `/api/rankings` endpoint
- Backend uses MCP client to fetch league data
- Processes data into 9-category statistics
- Returns sorted, ranked data
- Frontend displays color-coded table with sorting

### Data Flow

```
User Message → Frontend → Backend → OpenAI GPT-5 (with MCP tools)
                                          ↓
                                    Tool Calls
                                          ↓
                           Backend → MCP Client → Yahoo Fantasy API
                                          ↓
                                    Tool Results
                                          ↓
                           OpenAI GPT-5 → Final Response
                                          ↓
                           Backend → Frontend → User
```

## User Preferences

- **Design**: System-based modern design inspired by ChatGPT/Claude
- **Typography**: Inter for text, JetBrains Mono for stats
- **Data**: All non-parametric data must be in separate MCP servers (no hardcoding)
- **APIs**: Prefer free API endpoints over web scraping for reliability

## System Architecture

The application features a layered architecture comprising a React frontend, an Express Node.js backend, and isolated MCP (Model Context Protocol) servers for external data access. This design supports multi-tenancy, modularity, scalability, and security, with all sensitive credentials encrypted at rest.

### Frontend Layer (React + TypeScript + Vite)

- **Purpose**: User interface and client-side state management
- **Key Technologies**: wouter for routing, TanStack Query for server state, react-hook-form + zod for forms, shadcn/ui + Tailwind CSS for UI
- **UI/UX Decisions**: AI chat interface, 9-category master rankings page with sortable columns and color-coded performance indicators, user settings for credential management, mobile-first responsive design with light/dark modes, drawer-style sidebar on mobile, responsive typography

### Backend Layer (Express + Node.js)

- **Purpose**: API gateway, authentication, credential management, and MCP orchestration
- **Key Technologies**: Express.js with TypeScript, PostgreSQL via Drizzle ORM, Passport.js for authentication, AES-256-GCM for credential encryption
- **System Design Choices**: Secure account creation with bcrypt, per-user encrypted storage for Yahoo and OpenAI credentials, automatic Yahoo token refresh, and an API for AI chat interactions. Session-based authentication with secure cookies and CSRF protection is implemented

### MCP Server Layer (Model Context Protocol)

- **Purpose**: Isolated data access layer for external services
- **Technical Implementation**: A stdio-based server integrates with the Yahoo Fantasy API, providing 6 tools (leagues, standings, rosters, matchups, player stats, free agents). This layer is designed for extensibility to allow additional MCP servers for other data sources

### Security & Multi-Tenancy

- All credentials encrypted at rest using AES-256-GCM
- No shared API keys; each user provides their own
- Complete data isolation per user with session-based authentication
- Yahoo tokens auto-refresh and OpenAI API keys are never exposed client-side

## Technology Stack

### Frontend
- React 18: Component-based UI library
- TypeScript: Type-safe development
- Vite: Fast build tool and dev server
- Wouter: Lightweight routing
- TanStack Query v5: Server state management with caching
- React Hook Form: Form state and validation
- Zod: Runtime type validation
- shadcn/ui: Accessible component library
- Tailwind CSS: Utility-first styling
- Lucide React: Icon library

### Backend
- Express.js: Web application framework
- TypeScript: Type-safe server code
- Drizzle ORM: Type-safe database queries
- PostgreSQL: Relational database
- Passport.js: Authentication middleware
- bcrypt: Password hashing
- express-session: Session management

### MCP Integration
- MCP SDK: MCP protocol implementation
- stdio transport: Process-based communication
- Custom MCP client: Manages MCP server lifecycle

### External APIs
- Yahoo Fantasy Sports API: Real-time fantasy basketball data
- OpenAI API: Conversational AI with function calling

### Security
- Node.js crypto: AES-256-GCM encryption
- Secure sessions: HttpOnly cookies, CSRF protection

## Key Files

### Core Application
- **client/src/App.tsx**: Main application component with routing and sidebar setup
- **client/src/pages/chat.tsx**: Chat interface page with AI assistant
- **client/src/pages/rankings.tsx**: 9-category master rankings page
- **client/src/components/ChatDialog.tsx**: Reusable chat component with SSE streaming
- **client/src/components/SettingsDialog.tsx**: User credential management UI
- **server/routes.ts**: All API endpoints (auth, chat, rankings, settings, Yahoo OAuth)
- **server/index.ts**: Express server initialization and middleware setup

### Data & Storage
- **shared/schema.ts**: Database schema with Drizzle ORM (users, yahoo_credentials tables)
- **server/storage.ts**: Storage interface and PostgreSQL implementation
- **server/encryption.ts**: AES-256-GCM encryption/decryption utilities

### MCP Integration
- **server/mcp-client.ts**: MCP client for Yahoo Fantasy API integration
- **server/mcp/yahoo-fantasy-server.ts**: MCP server implementation with 6 tools
- **server/mcp/yahoo-api.ts**: Yahoo Fantasy API wrapper with token refresh

### Configuration
- **vite.config.ts**: Vite build configuration
- **tailwind.config.ts**: Tailwind CSS theme configuration
- **drizzle.config.ts**: Database migration configuration
- **tsconfig.json**: TypeScript compiler settings

### When to Touch Each File
- **Add new chat features**: client/src/pages/chat.tsx, client/src/components/ChatDialog.tsx
- **Add new API endpoints**: server/routes.ts
- **Add new database tables**: shared/schema.ts, then run db:push
- **Add new MCP tools**: server/mcp/yahoo-fantasy-server.ts
- **Modify Yahoo API calls**: server/mcp/yahoo-api.ts
- **Change encryption**: server/encryption.ts (⚠️ will invalidate existing credentials)
- **Add new pages**: Create in client/src/pages/, register in client/src/App.tsx
- **Update styling**: client/src/index.css (theme variables), component files (Tailwind classes)

## External Dependencies

1. **Yahoo Fantasy API**: Utilized for real-time access to fantasy basketball league data (team rosters, league standings, player statistics, matchups) via a dedicated MCP server
2. **OpenAI GPT-5**: Powers the core conversational AI chatbot for intelligent recommendations and function calling based on user queries and fantasy data
3. **PostgreSQL**: Serves as the primary relational database for persistent storage of user accounts, encrypted credentials, and session management data, interacting via Drizzle ORM

## Security Features

### Credential Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Source**: ENCRYPTION_KEY environment variable (64-character hex)
- **Scope**: Yahoo credentials and OpenAI API keys encrypted separately per user
- **Storage**: Encrypted values stored in PostgreSQL
- **Decryption**: Only happens server-side, never exposed to client

### Authentication & Sessions
- **Strategy**: Passport.js local strategy with bcrypt password hashing
- **Salt Rounds**: 10 (bcrypt default)
- **Session Storage**: Server-side sessions with express-session
- **Session Secret**: SESSION_SECRET environment variable (cryptographically random)
- **Session Lifetime**: Configurable (default: 7 days)
- **CSRF Protection**: State parameter validation for Yahoo OAuth

### Yahoo OAuth Security
- **State Parameter**: Cryptographic random string (32 bytes)
- **State Validation**: Server verifies state matches before token exchange
- **Token Storage**: Access and refresh tokens encrypted separately
- **Auto-Refresh**: Backend refreshes expired access tokens using refresh token
- **No Client Exposure**: Tokens never sent to frontend

### API Key Management
- **OpenAI Keys**: Per-user, encrypted at rest
- **Yahoo Credentials**: Per-user, encrypted at rest
- **Environment Variables**: Server-side only (ENCRYPTION_KEY, SESSION_SECRET, YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET)
- **Validation**: Credentials tested on setup before storage

### Operational Security Checklist

**Before Deployment:**
- Generate strong ENCRYPTION_KEY (64 hex characters)
- Generate strong SESSION_SECRET (32+ random characters)
- Set secure session cookies (secure: true in production)
- Enable HTTPS/TLS
- Verify Yahoo OAuth redirect URI matches production domain
- Set NODE_ENV=production

**Regular Maintenance:**
- Monitor failed login attempts
- Audit database for orphaned encrypted credentials
- Review session expiration settings
- Check for OpenAI API quota exhaustion patterns
- Monitor Yahoo token refresh failures

**If Compromised:**
- Rotate ENCRYPTION_KEY (⚠️ requires re-encrypting all credentials)
- Rotate SESSION_SECRET (invalidates all sessions)
- Revoke Yahoo OAuth application access
- Notify users to reset credentials

## Development

### Setup
Dependencies are automatically managed on Replit. Database schema uses Drizzle's push command for migrations.

### Database Migrations
**NEVER manually write SQL migrations**. Use Drizzle's push command:
- Safe push (warns on data loss): `db:push`
- Force push (bypasses warnings): `db:push --force`

**Important**: Changing primary key types (e.g., serial ↔ varchar) breaks existing data. Always check current schema first.

### MCP Server Development
The Yahoo Fantasy MCP server runs as a child process managed by server/mcp-client.ts. To test MCP tools:
1. Ensure Yahoo credentials are configured
2. Use the chat interface to trigger function calls
3. Check backend logs for MCP communication

To add new MCP tools:
1. Add tool definition to server/mcp/yahoo-fantasy-server.ts
2. Implement handler in the same file
3. Tool automatically available to OpenAI via function calling

### Environment Variables
**Required:**
- DATABASE_URL: PostgreSQL connection string
- ENCRYPTION_KEY: 64-character hex string for AES-256-GCM
- SESSION_SECRET: Random string for session signing
- YAHOO_CLIENT_ID: Yahoo Developer App Client ID
- YAHOO_CLIENT_SECRET: Yahoo Developer App Client Secret

**User-Provided (per user in Settings):**
- Yahoo Client ID
- Yahoo Client Secret
- OpenAI API Key

### Testing
**Test User:**
- Username: testuser
- Password: test123
- Test League: "皮卡丘打籃球 season 3" (league_key: 466.l.29849)

## Recent Changes

### 2024-11-14: Documentation Enrichment
- Added "What You've Built" section highlighting 5 core features
- Expanded "How It Works" with complete user journey and data flow
- Added "Technology Stack" section organized by layer
- Enhanced "Key Files" section with purpose and modification guidance
- Consolidated "Security Features" with operational checklists
- Added comprehensive "Development" section with setup, migrations, and testing

### 2024-11-10: User-Provided OpenAI API Keys
- Migrated from developer-owned ANTHROPIC_API_KEY to user-provided OpenAI API keys
- Added openai_api_key column to users table (encrypted)
- Updated Settings dialog with OpenAI API key input
- Modified /api/chat endpoint to use per-user OpenAI clients
- Users now pay for their own OpenAI usage (zero cost to developer)
- Each chat request initializes OpenAI client with user's decrypted key

**Migration Impact**: Eliminates developer's OpenAI costs, enables true multi-tenancy

### 2024-11-10: Migrated from Anthropic to OpenAI GPT-5
- Replaced Anthropic Claude with OpenAI GPT-5 for chat completions
- Switched from @anthropic-ai/sdk to openai package
- Updated chat streaming from Anthropic's format to OpenAI's Server-Sent Events (SSE)
- Modified function calling to use OpenAI's tools parameter format
- Updated frontend SSE parsing for OpenAI's event stream structure

**Technical Changes**: OpenAI uses different streaming format (SSE with data: [DONE] vs Anthropic's custom events)

### 2024-11-07: Sortable Rankings Table with Gradient Colors
- Implemented fully sortable 9-category rankings table
- Added gradient color coding: green (top teams) → yellow (middle) → red (bottom)
- Click any column header to sort by that category
- Master rank calculated by averaging each team's position across all 9 categories
- Color intensity reflects performance within each category

**Implementation**: Uses percentile-based color assignment with hsl() for smooth gradients

### 2024-11-06: Mobile-Responsive Design Overhaul
- Implemented mobile-first responsive design across all pages
- Sidebar collapses to drawer on mobile (< 768px breakpoint)
- Chat interface optimized for touch interactions
- Rankings table horizontally scrollable on mobile with sticky team column
- Settings dialog adapts to small screens
- Responsive typography scaling

**Key Changes**: Drawer sidebar, touch-friendly buttons, horizontal scroll for data tables

### 2024-11-06: 9-Category Master Rankings Page
- Created dedicated /rankings page accessible from sidebar
- Displays all teams ranked across 9 fantasy categories: FG%, FT%, 3PM, PTS, REB, AST, STL, BLK, TO
- Added /api/rankings endpoint that fetches league data via MCP
- Implemented category ranking algorithm (lower is better for TO, higher for others)
- Color-coded table cells for visual ranking feedback
- Master rank column shows average position across all categories

**Data Source**: Yahoo Fantasy API via MCP get_league_standings tool

### 2024-11-03: Multi-User Authentication with Per-User Yahoo Credentials
- Implemented user registration and login with Passport.js
- Created users table with bcrypt password hashing
- Modified credential storage to be per-user instead of global
- Added encrypted yahoo_credentials table linked to user accounts
- Each user maintains their own Yahoo OAuth tokens and OpenAI API key
- Session-based authentication protects all API routes

**Security**: Complete data isolation between users, no shared API keys

### 2024-11-02: Yahoo Fantasy OAuth & MCP Implementation
- Integrated Yahoo Fantasy Sports API with OAuth 2.0 authentication
- Implemented MCP (Model Context Protocol) server for Yahoo Fantasy data access
- Created 6 MCP tools: get_user_leagues, get_league_standings, get_team_roster, get_league_matchups, get_player_stats, get_league_free_agents
- Built OAuth flow with state parameter for CSRF protection
- Automatic token refresh mechanism for expired access tokens
- Encrypted storage of Yahoo credentials (Client ID, Client Secret, tokens)

**Key File**: server/mcp/yahoo-fantasy-server.ts (MCP server), server/mcp-client.ts (MCP client wrapper)
