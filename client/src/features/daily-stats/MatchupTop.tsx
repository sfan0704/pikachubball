import type { ReactNode } from "react";

/**
 * Matchup's top block: the score card and the day bar. On a phone and from md
 * it sticks under the app header so the score stays in view while the players
 * scroll; from lg everything fits beside it, so it scrolls with the page.
 */
export function MatchupTop({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky top-[var(--app-header-height)] z-[5] -mx-4 flex flex-col gap-2.5 border-b border-[#E2E5EA] bg-background px-4 pb-2.5 pt-3 md:-mx-8 md:px-8 lg:static lg:mx-0 lg:gap-5 lg:border-b-0 lg:p-0 dark:border-border"
      data-testid="matchup-top"
    >
      {children}
    </div>
  );
}

/**
 * Everything under the top block. One column in the phone's order below lg;
 * from lg, two: the totals (and the details panel) beside the players.
 */
export function MatchupColumns({ players, children }: { players: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-5 lg:space-y-0">
      {/* Hidden while empty, so a loading board keeps the phone's spacing. */}
      <div className="space-y-5 empty:hidden">{children}</div>
      {players}
    </div>
  );
}

/** A white board section with an uppercase title and a short hint on the right. */
export function BoardCard({
  title,
  hint,
  label,
  titleTestId,
  children,
}: {
  title: ReactNode;
  hint?: string;
  /** Names the section for screen readers. */
  label: string;
  titleTestId?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="rounded-2xl border border-[#E2E5EA] bg-white p-3.5 dark:border-border dark:bg-card"
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2
          className="truncate text-xs font-bold uppercase tracking-[0.5px] text-[#374151] dark:text-muted-foreground"
          data-testid={titleTestId}
        >
          {title}
        </h2>
        {hint && (
          <span className="shrink-0 text-[11px] text-[#4B5563] dark:text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
