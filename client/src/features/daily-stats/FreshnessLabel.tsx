import { freshnessLabel, type FreshnessSource } from "@/features/league/freshness";

interface FreshnessLabelProps {
  /** Every section the label speaks for; the Matchup header passes all of its sections. */
  sources: readonly FreshnessSource[];
  /** The current time, so the label can be tested. */
  now: number;
}

/** "Updated N min ago" for the oldest section, or the stale label after a failed refresh. */
export function FreshnessLabel({ sources, now }: FreshnessLabelProps) {
  const label = freshnessLabel(sources, now);
  if (label === null) {
    return null;
  }
  return (
    <p
      data-testid="text-freshness"
      className={`text-xs ${label.stale ? "text-destructive" : "text-muted-foreground"}`}
    >
      {label.text}
    </p>
  );
}
