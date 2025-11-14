# Fantasy Basketball AI Assistant

## Overview
An agentic chatbot application for Yahoo Fantasy Basketball analysis that helps users optimize their fantasy teams through AI-powered insights from multiple data sources. The application provides intelligent, data-driven recommendations for start/sit decisions, waiver pickups, and trade analysis, aiming to help users win their Yahoo Fantasy Basketball leagues. It includes a multi-user system where each user provides their own API credentials (Yahoo + OpenAI), ensuring privacy and cost control.

## User Preferences
- Design: System-based modern design inspired by ChatGPT/Claude
- Typography: Inter for text, JetBrains Mono for stats
- Data: All non-parametric data must be in separate MCP servers (no hardcoding)
- APIs: Prefer free API endpoints over web scraping for reliability

## System Architecture

### System Overview
The application follows a layered architecture with clear separation between presentation (React frontend), business logic (Express backend), and data access (MCP servers). This design enables multi-tenancy, modularity, scalability, and security, with all credentials encrypted at rest.

### Layers

#### 1. Frontend Layer (React + TypeScript + Vite)
- **Purpose**: User interface and client-side state management.
- **Key Technologies**: `wouter` for routing, `TanStack Query` for server state, `react-hook-form` + `zod` for forms, `shadcn/ui` + `Tailwind CSS` for UI components.
- **Features**: AI-powered chat interface, 9-category master rankings with sortable, color-coded tables, mobile-first responsive design.

#### 2. Backend Layer (Express + Node.js)
- **Purpose**: API gateway, authentication, credential management, MCP orchestration.
- **Key Technologies**: Express.js with TypeScript, PostgreSQL via Drizzle ORM, Passport.js for authentication, AES-256-GCM for encryption.
- **Data Persistence**: Stores user accounts, encrypted Yahoo credentials, Yahoo OAuth tokens, and encrypted OpenAI API keys.
- **Key Design Decisions**: Per-user encryption, automatic Yahoo token refresh, session-based authentication, and abstraction of Yahoo API calls via the MCP server.

#### 3. MCP Server Layer (Model Context Protocol)
- **Purpose**: Isolated data access layer for external services.
- **Yahoo Fantasy MCP Server**: A stdio-based child process handling Yahoo Fantasy API integration. It provides tools for accessing leagues, standings, rosters, matchups, player stats, and free agents.
- **Extension Point**: Designed to allow additional MCP servers for other data sources like NBA stats (BALLDONTLIE API), Reddit discussions, YouTube transcripts, and ESPN news.

### Key Architectural Invariants
- **Security**: All credentials encrypted at rest, no shared API keys, auto-refreshing Yahoo tokens, never exposes OpenAI API keys to the client.
- **Multi-Tenancy**: Complete data isolation per user with per-user credential storage and session-based authentication.
- **Modularity**: Pluggable MCP servers, frontend agnostic to data sources, backend orchestrates without implementing data access directly, clear responsibilities for each layer.

## External Dependencies
1.  **Yahoo Fantasy API**: Used for accessing team rosters, league data, and matchups (integrated via a dedicated MCP server).
2.  **OpenAI GPT-5**: Powers the conversational AI chatbot, utilizing user-provided API keys for intelligent recommendations and function calling.
3.  **PostgreSQL**: The primary database for persistent storage of user accounts, encrypted credentials, and session data, managed with Drizzle ORM.