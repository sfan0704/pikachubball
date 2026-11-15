/**
 * The Matchup board's player columns: how each column is ordered for a
 * category, and when a value is called out against the player's average.
 * Pure; the screens only format what these return.
 */
import { categoryEntry, isPercentage, type CategoryEntry, type CategoryValues } from "./categories";
import { versusAverage, type VersusAverage } from "./daily-stats";
import { appearance, type Appearance, type StatLine } from "./stat-value";
import type { LeagueCategory } from "./team-table";
import type { TotalsComparison } from "./views";

/**
 * The category the board opens on: the lost category closest to turning,
 * measured relative to the larger side. With no lost category, the first one;
 * null only for a league without categories.
 */
export function closestLostCategory(comparison: TotalsComparison): LeagueCategory | null {
  let best: LeagueCategory | null = comparison.categories[0]?.category ?? null;
  let bestGap = Infinity;
  for (const { category, mine, theirs, result } of comparison.categories) {
    if (result !== "loss" || mine === null || theirs === null) {
      continue;
    }
    const gap = Math.abs(mine - theirs) / Math.max(Math.abs(mine), Math.abs(theirs), 0.001);
    if (gap < bestGap) {
      best = category;
      bestGap = gap;
    }
  }
  return best;
}

/** One player in a Matchup column, as far as ordering needs. */
export interface ColumnPlayer {
  readonly isStartingSlot: boolean;
  readonly line: StatLine;
}

// Played first, then values still to come, then players with nothing to add.
const APPEARANCE_ORDER: Readonly<Record<Appearance, number>> = {
  played: 0,
  unavailable: 1,
  notYetPlayed: 2,
  noGame: 3,
  didNotPlay: 4,
};

/**
 * The number a column sorts on: attempts for a percentage (volume decides
 * it), else the value; nothing measured sorts as 0.
 */
function sortValue(entry: CategoryEntry, category: LeagueCategory): number {
  if (entry.kind !== "value") {
    return 0;
  }
  if (entry.parts && isPercentage(category)) {
    return entry.parts.bottom;
  }
  return entry.value ?? 0;
}

/**
 * One team's column ordered for a category: counted slots before bench and
 * IL, players who played before the rest, then best first (fewest turnovers,
 * most attempts for a percentage). Equal players keep their roster order,
 * which is all that orders them while the league's categories are unknown.
 */
export function orderForCategory<T extends ColumnPlayer>(
  players: readonly T[],
  category: LeagueCategory | null
): T[] {
  const lowerIsBetter = category?.direction === "lower" && !isPercentage(category);
  const keyed = players.map((player, index) => ({
    player,
    index,
    group: player.isStartingSlot ? 0 : 1,
    shown: APPEARANCE_ORDER[appearance(player.line)],
    value: category ? sortValue(categoryEntry(player.line, category), category) : 0,
  }));
  keyed.sort(
    (a, b) =>
      a.group - b.group ||
      a.shown - b.shown ||
      (lowerIsBetter ? a.value - b.value : b.value - a.value) ||
      a.index - b.index
  );
  return keyed.map(({ player }) => player);
}

/**
 * How a player's value in a category compares with their per-game average.
 * Only counted players who played are called out, and a game still in
 * progress is never called worse, because it may yet catch up.
 */
export function dayCallout(
  category: LeagueCategory,
  entry: CategoryEntry,
  average: CategoryValues | null,
  isStartingSlot: boolean,
  gameIsLive: boolean
): VersusAverage {
  if (!isStartingSlot || entry.kind !== "value" || average === null) {
    return "unavailable";
  }
  const result = versusAverage(category, entry.value, average[category.statId] ?? null);
  return result === "worse" && gameIsLive ? "usual" : result;
}
