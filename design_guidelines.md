# Design Guidelines: Fantasy Basketball AI Chatbot

## Design Approach

**System-Based Design** drawing inspiration from modern AI chat interfaces (ChatGPT, Claude) combined with sports analytics platforms (ESPN Fantasy, Linear). This approach prioritizes clarity, information density, and efficient data consumption over decorative elements.

**Core Principles:**
- Information-first hierarchy
- Conversational interaction patterns
- Multi-source data attribution
- Clean, distraction-free analysis environment

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Tight spacing (2, 4): Icon gaps, button padding
- Medium spacing (6, 8): Card padding, list items
- Generous spacing (12, 16): Section separation, page margins

**Container Strategy:**
- Main chat area: `max-w-4xl mx-auto` - optimal reading width for conversations
- Sidebar (data panels): Fixed `w-80` on desktop, full-width drawer on mobile
- Full-width data visualizations when needed within conversation flow

**Grid Systems:**
- 2-column layout: Chat (main) + Data panel (sidebar) on desktop (≥1024px)
- Single column stack on mobile/tablet
- 3-column grid for stat comparisons within chat messages
- 2x2 grid for player cards in recommendations

---

## Typography

**Font Stack:**
- Primary: Inter (via Google Fonts) - exceptional readability for data and chat
- Monospace: JetBrains Mono - for stats, numbers, code snippets

**Type Scale:**
- Page Title: `text-2xl font-semibold` (32px)
- Section Headers: `text-xl font-semibold` (24px)
- Chat Messages: `text-base` (16px) - user and AI responses
- Metadata/Timestamps: `text-sm text-gray-500` (14px)
- Player Stats/Numbers: `text-lg font-mono font-semibold` (18px)
- Small Labels: `text-xs` (12px)

**Text Hierarchy in Chat:**
- User messages: Standard weight, right-aligned
- AI responses: Standard weight, left-aligned with avatar
- Data citations: Italic, smaller size with source badge
- Player names: Font-semibold for emphasis
- Stats/Metrics: Monospace font for numerical clarity

---

## Component Library

### Core Chat Components

**Chat Container:**
- Full-height layout with fixed input at bottom
- Scrollable message area with smooth auto-scroll
- Padding: `px-4 py-6` for messages, `p-4` for input area
- Background differentiation between user/AI messages using subtle borders

**Message Bubbles:**
- User: Right-aligned, rounded corners `rounded-2xl rounded-tr-sm`
- AI: Left-aligned with avatar, rounded `rounded-2xl rounded-tl-sm`
- Max-width: `max-w-2xl` to prevent overly wide text blocks
- Padding: `px-4 py-3` for text, `p-6` for rich content

**Chat Input:**
- Multi-line textarea with auto-expand (max 5 lines)
- Send button integrated on right side
- Height: `min-h-[56px]`, padding `p-4`
- Rounded borders `rounded-xl`
- Focus state with ring indicator

### Data Display Components

**Stat Cards:**
- Compact card format: `rounded-lg` with `p-4` padding
- Header with player name + position badge
- 2-column stat grid within card
- Border to separate from background

**Player Comparison Tables:**
- Clean table layout with alternating row subtle backgrounds
- Column headers with semibold weight
- Monospace numbers right-aligned
- Sticky header on scroll for long tables
- Minimum column width to prevent cramping

**Source Attribution Badges:**
- Small pill badges: `rounded-full px-3 py-1 text-xs`
- Display data source (Reddit, YouTube, BALLDONTLIE, ESPN)
- Positioned at bottom of AI responses using that source
- Clickable to show full source context

**Loading States:**
- Skeleton loaders matching content shape for chat responses
- Pulsing animation for data cards being fetched
- Inline loading indicators for MCP server queries
- "Thinking..." indicator with animated dots

### Navigation & Structure

**Top Navigation Bar:**
- Fixed header: `h-16` with shadow
- Logo/Title on left, user menu on right
- Current league/team selector in center
- Padding: `px-6`

**Sidebar (Data Panel):**
- Fixed position on desktop: `w-80`
- Collapsible with toggle icon
- Sections: Team Roster, League Standings, Today's Games
- Scrollable independently from chat
- Slide-out drawer on mobile

**Quick Action Bar:**
- Floating above chat input
- Common queries as pill buttons: "Start/Sit Today", "Waiver Wire", "Trade Suggestions"
- Horizontal scroll on mobile
- Spacing: `gap-2`, padding `py-3`

### Data Visualizations

**Mini Charts (Embedded in Chat):**
- Player performance trends: Sparkline charts
- Team comparison: Simple bar charts
- Height constraints: `h-40` to `h-64` depending on complexity
- Responsive sizing with viewport

**Recommendation Lists:**
- Ordered list with ranking numbers
- Player cards in grid: 2 columns on desktop, 1 on mobile
- Each card shows: Name, position, team, key stats, recommendation reason
- Hover state shows expanded stats

**Calendar/Schedule View:**
- Weekly grid showing daily matchups
- Each day is a card: `rounded-lg p-3`
- Start/Sit recommendations color-coded
- Spacing: `gap-4` between days

---

## Interaction Patterns

**Chat Interactions:**
- Auto-focus on input after message sent
- Optimistic UI: Show user message immediately
- Streaming response: AI message appears progressively
- Edit previous message: Inline pencil icon on hover
- Copy response: Clipboard icon on AI messages
- Regenerate response: Refresh icon for last AI message

**Data Source Transparency:**
- AI explains which MCP servers it's querying
- Real-time status indicators: "Fetching Reddit discussions...", "Analyzing YouTube transcripts..."
- Failed source fetch shows graceful fallback message

**Contextual Actions:**
- Player names are clickable → Shows detailed stats modal
- Trade suggestions have "Analyze Trade" button
- Waiver recommendations have "View Player Profile" action

**Mobile Adaptations:**
- Bottom navigation for main sections
- Swipe to close sidebar drawer
- Tap outside chat input to collapse keyboard
- Sticky chat input always accessible

---

## Visual Treatment Notes

**No Color Specifications** - Colors defined separately. Focus on:
- Clear borders for component separation
- Subtle backgrounds for hierarchy (not color-based)
- Text weight variations for emphasis
- Spacing for visual grouping

**Minimal Animation:**
- Fade-in for new messages (200ms)
- Smooth scroll for auto-scroll to latest message
- Skeleton pulse for loading states
- No decorative animations or parallax effects

**Accessibility:**
- All interactive elements have clear focus states
- Minimum touch target: 44x44px
- Semantic HTML for screen readers
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels for icon-only buttons

---

## Images

**No Hero Image** - This is a utility application, not a marketing page.

**Profile/Avatar Images:**
- User avatar in top right: `w-10 h-10 rounded-full`
- AI assistant icon in chat: `w-8 h-8 rounded-full`
- Player headshots in cards: `w-12 h-12 rounded-lg`

**Logo/Branding:**
- App logo in top left: `h-8` max height
- Team logos in roster/standings: `w-6 h-6`

All images should be optimized and use appropriate alt text for accessibility.