import type { NbaGame } from "@shared/api/daily-stats-values";
import { isLive } from "@shared/domain";
import { freshnessLabel, type FreshnessSource } from "@/features/league/freshness";
import { ShellSlot } from "@/features/shell/shell-slots";
import { cn } from "@/lib/utils";

/** What the line says about the board's games. */
export type BoardState = "live" | "delayed" | "final" | "updated";

/**
 * Delayed after a failed refresh wins, because the values may be behind. Then
 * live while any shown game is on, final once every shown game has ended.
 */
export function boardState(
  games: readonly (NbaGame | null | undefined)[],
  refreshFailed: boolean
): BoardState {
  if (refreshFailed) {
    return "delayed";
  }
  const known = games.filter((game): game is NbaGame => game !== null && game !== undefined);
  if (known.some((game) => isLive(game.state))) {
    return "live";
  }
  const allKnown = games.every((game) => game !== undefined);
  return allKnown && known.every((game) => game.state.kind === "final") ? "final" : "updated";
}

const DOT: Readonly<Record<BoardState, string>> = {
  live: "bg-red-600",
  delayed: "bg-amber-500",
  final: "bg-muted-foreground",
  updated: "bg-green-600",
};

const LEAD: Readonly<Record<BoardState, string>> = {
  live: "Live · ",
  delayed: "",
  final: "Final · all games complete · ",
  updated: "",
};

interface FreshnessLineProps {
  /** Every section on the board; the shared label reads the oldest age and any failed refresh. */
  readonly sources: readonly FreshnessSource[];
  /** The games of the players shown; null for no game, undefined while unknown. */
  readonly games: readonly (NbaGame | null | undefined)[];
  readonly now: number;
}

/** One line in the header on how current the board is: live, delayed, final, and the shared age label. */
export function FreshnessLine({ sources, games, now }: FreshnessLineProps) {
  const label = freshnessLabel(sources, now);
  if (label === null) {
    return null;
  }
  const state = boardState(games, label.stale);
  return (
    <ShellSlot name="freshness">
      <p
        className={cn(
          "flex items-center gap-1.5 text-[11px]",
          label.stale ? "text-destructive" : "text-muted-foreground"
        )}
        data-testid="freshness"
        data-state={state}
      >
        <span aria-hidden="true" className={cn("size-[7px] rounded-full", DOT[state])} />
        {LEAD[state]}
        {label.text}
      </p>
    </ShellSlot>
  );
}
