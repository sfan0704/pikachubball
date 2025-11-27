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

**Type Safety Patterns:**
```typescript
// ✅ Narrow, specific types
type Status = 'active' | 'inactive' | 'pending';

// ✅ Interface over 'any'
interface User { id: number; name: string; }
function processUser(user: User): void {}

// ✅ Explicit return types for complex functions
function getUser(id: number): User | null { /* ... */ }
```

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
- Never call component functions directly — only use components in JSX
- Single Responsibility: each component = one function/concern
- Lift state to the closest common parent for one-way data flow
- Extract reusable logic into custom hooks

**Component Patterns:**
```typescript
// ✅ Functional component with hooks
function UserCard({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId);
  return <div>{user?.name}</div>;
}

// ✅ Custom hook for reusable logic
function useUser(id: string) {
  const [user, setUser] = useState(null);
  useEffect(() => { /* fetch user */ }, [id]);
  return { user, isLoading: false };
}
```

### Express.js Best Practices

**Official Resources:**
- Performance Best Practices: https://expressjs.com/en/advanced/best-practice-performance.html
- Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices

**Key Rules:**
- Set `NODE_ENV=production` (critical for performance — caches templates, generates concise error messages)
- Use `next()` for error propagation through middleware chain
- Always wrap async operations in try-catch; use middleware for error handling
- Use Helmet.js for security headers, express-validator for input validation
- Rate limiting: prevent brute-force attacks with express-rate-limit
- Structure routes modularly: one routes file per entity (users.ts, leagues.ts, etc.)
- Store secrets in `.env`, never hardcode API keys or credentials
- Use `const` over `let`/`var` for immutability

**Project Structure:**
```
/server
├── /routes          # Route definitions per entity
├── /services        # Business logic, external API calls
├── /auth-routes.ts  # Authentication logic
├── storage.ts       # Database/storage interface
├── db.ts            # Database connection
├── index.ts         # Express app initialization
```

**Error Handling Pattern:**
```typescript
app.post("/api/users", async (req, res, next) => {
  try {
    const validatedData = userSchema.parse(req.body);
    const result = await storage.createUser(validatedData);
    res.json(result);
  } catch (error) {
    next(error); // Pass to error middleware
  }
});

// Global error handler (last middleware)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

### Tailwind CSS Best Practices

**Official Resources:**
- Utility-First Fundamentals: https://tailwindcss.com/docs/styling-with-utility-classes
- Reusing Styles: https://v3.tailwindcss.com/docs/reusing-styles
- Adding Custom Styles: https://tailwindcss.com/docs/adding-custom-styles
- Tailwind Config: https://tailwindcss.com/docs/configuration

**Key Rules:**
- **Prefer components over `@apply`**: Create React components instead of custom CSS classes
- Use `@apply` only for small, highly reusable elements (buttons, badges) when framework components aren't available
- Centralize design tokens in `tailwind.config.ts` (colors, spacing, typography)
- Mobile-first: use breakpoint prefixes `sm:`, `md:`, `lg:`, `xl:` progressively
- Use arbitrary values sparingly: `class="top-[117px]"` only for one-off styles
- Order utility classes consistently: layout → positioning → box-model → typography → visual → misc
- Don't use string concatenation for dynamic classes: use complete class name objects or `clsx`
- Never modify utility classes in production; let Tailwind's purge optimize CSS

**Component Pattern (React):**
```tsx
// ✅ Extract to components instead of @apply
function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="py-2 px-5 bg-violet-500 text-white font-semibold rounded-full shadow-md hover:bg-violet-700 hover:elevate active:elevate-2">
      {children}
    </button>
  );
}

// ✅ Centralize theme in config
// tailwind.config.ts
theme: {
  extend: {
    colors: { 'brand-primary': '#7743DB' }
  }
}

// Use semantic names: bg-brand-primary instead of arbitrary values
```

**Design System Integration:**
- All colors, spacing, and typography come from `tailwind.config.ts` (see design_guidelines.md)
- Use CSS variables for dynamic theming (light/dark mode)
- Leverage existing shadcn/ui components for consistency