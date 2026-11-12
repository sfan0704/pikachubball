import type { ReactNode } from "react";

/**
 * Matchup's top block: the score card and the day bar. It sticks under the
 * app header so the score stays in view while the players scroll.
 */
export function MatchupTop({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky top-[var(--app-header-height)] z-[5] -mx-4 flex flex-col gap-2.5 border-b border-[#E2E5EA] bg-[#F3F4F6] px-4 pb-2.5 pt-3 md:-mx-6 md:px-6 dark:border-border dark:bg-background"
      data-testid="matchup-top"
    >
      {children}
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
