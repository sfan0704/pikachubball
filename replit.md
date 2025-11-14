# Fantasy Basketball AI Assistant

### Overview
This project is a multi-user AI chatbot application designed to help users optimize their Yahoo Fantasy Basketball teams. It provides intelligent, data-driven recommendations for start/sit decisions, waiver pickups, and trade analysis through an AI-powered conversational interface. The application aims to help users win their fantasy leagues by leveraging AI-powered insights from multiple data sources, including real-time Yahoo Fantasy data. Each user provides their own API credentials (Yahoo + OpenAI), ensuring complete privacy and cost control.

The application offers an AI-Powered Chat Assistant with 6 integrated tools (leagues, standings, rosters, matchups, player stats, free agents) and a dedicated `/rankings` page for 9-Category Master Rankings, analyzing team strength across all fantasy categories with sortable, color-coded performance indicators. It supports secure multi-user accounts, per-user encrypted credential storage, and a mobile-first responsive design.

### User Preferences
- Design: System-based modern design inspired by ChatGPT/Claude
- Typography: Inter for text, JetBrains Mono for stats
- Data: All non-parametric data must be in separate MCP servers (no hardcoding)
- APIs: Prefer free API endpoints over web scraping for reliability

### System Architecture
The application features a layered architecture comprising a React frontend, an Express Node.js backend, and isolated MCP (Model Context Protocol) servers for external data access. This design supports multi-tenancy, modularity, scalability, and security, with all sensitive credentials encrypted at rest.

**Frontend Layer (React + TypeScript + Vite)**
-   **Purpose**: User interface and client-side state management.
-   **Key Technologies**: `wouter` for routing, `TanStack Query` for server state, `react-hook-form` + `zod` for forms, `shadcn/ui` + `Tailwind CSS` for UI.
-   **Features**: AI chat interface, 9-category master rankings page, user settings for credential management, mobile-first responsive design with light/dark modes.

**Backend Layer (Express + Node.js)**
-   **Purpose**: API gateway, authentication, credential management, and MCP orchestration.
-   **Key Technologies**: Express.js with TypeScript, PostgreSQL via Drizzle ORM, Passport.js for authentication, AES-256-GCM for credential encryption.
-   **Features**: Secure account creation, per-user encrypted storage for Yahoo and OpenAI credentials, automatic Yahoo token refresh, and an API for AI chat interactions. The backend abstracts Yahoo API access through the MCP server.

**MCP Server Layer (Model Context Protocol)**
-   **Purpose**: Isolated data access layer for external services.
-   **Yahoo Fantasy MCP Server**: A stdio-based server that integrates with the Yahoo Fantasy API, providing 6 tools for accessing league data.
-   **Extensibility**: Designed to allow additional MCP servers for other data sources.

**Security & Multi-Tenancy**
-   All credentials encrypted at rest using AES-256-GCM.
-   No shared API keys; each user provides their own.
-   Complete data isolation per user with session-based authentication.
-   Yahoo tokens auto-refresh and OpenAI API keys are never exposed client-side.

### External Dependencies
1.  **Yahoo Fantasy API**: Utilized for real-time access to fantasy basketball league data (team rosters, league standings, player statistics, matchups) via a dedicated MCP server.
2.  **OpenAI GPT-5**: Powers the core conversational AI chatbot for intelligent recommendations and function calling based on user queries and fantasy data.
3.  **PostgreSQL**: Serves as the primary relational database for persistent storage of user accounts, encrypted credentials, and session management data, interacting via Drizzle ORM.
## What You've Built

A **multi-user AI chatbot application** that helps users win their Yahoo Fantasy Basketball leagues through intelligent, data-driven recommendations. Each user provides their own API credentials (Yahoo + OpenAI), ensuring complete privacy and cost control.

### Core Features

**1. AI-Powered Chat Assistant**
- Conversational interface powered by OpenAI GPT-5
- Direct access to user's Yahoo Fantasy data through function calling
- 6 integrated tools: leagues, standings, rosters, matchups, player stats, free agents

**2. 9-Category Master Rankings**
- Dedicated page analyzing team strength across all fantasy categories
- Sortable columns with color-coded performance indicators

**3. Multi-User System**
- Secure account creation with username/password authentication
- Complete data isolation between users
- Per-user encrypted credential storage

**4. User-Provided Credentials (Zero Developer Costs!)**
- Each user provides their own Yahoo and OpenAI API credentials
- AES-256-GCM encryption for all credentials
- Users pay for their own OpenAI usage

**5. Mobile-First Responsive Design**
- Works seamlessly on phones, tablets, and desktop

