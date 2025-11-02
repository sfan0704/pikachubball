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
- **Sidebar**: Team roster view, player stats cards, quick actions
- **Theme Support**: Light/dark mode with system-based design
- **Components**: ChatMessage, ChatInput, PlayerStatCard, TeamRoster, QuickActions, ComparisonTable, YahooConnect

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

### 2024-11-02: Yahoo Fantasy OAuth & MCP Implementation
- Implemented Yahoo Fantasy OAuth 2.0 with `fspt-w` scope for read/write access
- Added CSRF protection using cryptographic state parameter with 10-minute expiry
- Built token invalidation handling with automatic cleanup and re-authentication prompts
- Created Yahoo Fantasy MCP server with 7 tools for fantasy data access
- Developed MCP client integration layer (`server/mcp-client.ts`)
- Added YahooConnect component with reconnection affordances

### Security Features
- CSRF protection via state parameter validation
- Secure token storage with automatic refresh
- 401/403 error handling with token cleanup
- Environment-based secret management (YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, ANTHROPIC_API_KEY)

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
- `client/src/pages/ChatPage.tsx`: Main chat interface
- `client/src/components/YahooConnect.tsx`: OAuth connection UI
- `server/yahoo-auth.ts`: OAuth flow, token management, API requests
- `server/routes.ts`: Backend API routes
- `server/mcp-client.ts`: MCP client integration layer
- `mcp-servers/yahoo-fantasy/`: Standalone Yahoo Fantasy MCP server
- `shared/schema.ts`: Data models and types
- `server/storage.ts`: In-memory storage interface

## Environment Variables
- `YAHOO_CLIENT_ID`: Yahoo app client ID
- `YAHOO_CLIENT_SECRET`: Yahoo app client secret
- `ANTHROPIC_API_KEY`: Claude API key for AI responses
- `SESSION_SECRET`: Express session secret

## Development
- Port 5000: Combined Express + Vite server
- Workflow: `npm run dev` starts both backend and frontend
- Storage: In-memory storage (MemStorage) for development
