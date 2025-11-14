# Fantasy Basketball AI Assistant

## Overview

This project is a multi-user AI chatbot application designed to help users optimize their Yahoo Fantasy Basketball teams. It provides intelligent, data-driven recommendations for start/sit decisions, waiver pickups, and trade analysis through an AI-powered conversational interface. The application leverages AI-powered insights from multiple data sources, including real-time Yahoo Fantasy data. Each user provides their own API credentials (Yahoo + OpenAI), ensuring complete privacy and cost control.

The project's ambition is to create a powerful, personalized, and private AI assistant for fantasy sports, with potential for broader market application in data-driven decision-making tools.

## User Preferences

- **Design**: System-based modern design inspired by ChatGPT/Claude
- **Typography**: Inter for text, JetBrains Mono for stats
- **Data**: All non-parametric data must be in separate MCP servers (no hardcoding)
- **APIs**: Prefer free API endpoints over web scraping for reliability

## System Architecture

The application features a layered architecture comprising a React frontend, an Express Node.js backend, and isolated MCP (Model Context Protocol) servers for external data access. This design supports multi-tenancy, modularity, scalability, and security, with all sensitive credentials encrypted at rest.

### Frontend Layer (React + TypeScript + Vite)

- **Purpose**: User interface and client-side state management.
- **Key Technologies**: wouter for routing, TanStack Query for server state, react-hook-form + zod for forms, shadcn/ui + Tailwind CSS for UI.
- **UI/UX Decisions**: AI chat interface, 9-category master rankings page with sortable columns and color-coded performance indicators, user settings for credential management, mobile-first responsive design with light/dark modes, drawer-style sidebar on mobile, responsive typography.

### Backend Layer (Express + Node.js)

- **Purpose**: API gateway, authentication, credential management, and MCP orchestration.
- **Key Technologies**: Express.js with TypeScript, PostgreSQL via Drizzle ORM, Passport.js for authentication, AES-256-GCM for credential encryption.
- **System Design Choices**: Secure account creation with bcrypt, per-user encrypted storage for Yahoo and OpenAI credentials, automatic Yahoo token refresh, and an API for AI chat interactions. Session-based authentication with secure cookies and CSRF protection is implemented.

### MCP Server Layer (Model Context Protocol)

- **Purpose**: Isolated data access layer for external services.
- **Technical Implementation**: A stdio-based server integrates with the Yahoo Fantasy API, providing 6 tools (leagues, standings, rosters, matchups, player stats, free agents). This layer is designed for extensibility to allow additional MCP servers for other data sources.

### Security Features

- **Credential Encryption**: AES-256-GCM for Yahoo credentials and OpenAI API keys, stored encrypted in PostgreSQL.
- **Multi-Tenancy**: Complete data isolation between users, with each user providing their own credentials.
- **Authentication**: Passport.js with bcrypt hashing, server-side sessions, and HttpOnly cookies.
- **Yahoo OAuth Security**: State parameter for CSRF protection, encrypted token storage, and automatic token refresh.

## External Dependencies

1.  **Yahoo Fantasy API**: Utilized for real-time access to fantasy basketball league data (team rosters, league standings, player statistics, matchups) via a dedicated MCP server.
2.  **OpenAI GPT-5**: Powers the core conversational AI chatbot for intelligent recommendations and function calling based on user queries and fantasy data.
3.  **PostgreSQL**: Serves as the primary relational database for persistent storage of user accounts, encrypted credentials, and session management data, interacting via Drizzle ORM.