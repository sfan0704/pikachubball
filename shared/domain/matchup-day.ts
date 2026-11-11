/**
 * The Matchup board's player columns: what a player's line says about one
 * category, how each column is ordered, and when a value is called out against
 * the player's average. Pure; the screens only format what these return.
 */
import { CATEGORY_DIRECTIONS, percentage } from "./fantasy-rules";
import { appearance, type Appearance, type MakesAttempts, type StatLine } from "./stat-value";
import { CATEGORIES, type CategoryKey } from "./stats";
import { versusAverage, type CategoryValues, type VersusAverage } from "./daily-stats";
import type { TotalsComparison } from "./views";

/** True for the two shooting categories, which are made from makes over attempts. */
export function isShootingCategory(key: CategoryKey): key is "fgPct" | "ftPct" {
  return key === "fgPct" || key === "ftPct";
}

/** A player's value in one category on one date. */
export type CategoryEntry =
  | {
      readonly kind: "value";
      /** The category's value: a count, or makes over attempts (null when nothing was attempted). */
      readonly value: number | null;
      /** Makes and attempts for FG% and FT%; null for counting categories. */
      readonly shots: MakesAttempts | null;
    }
  | { readonly kind: Exclude<Appearance, "played"> };

/** What a line says about one category: the measured value, or why there is none. */
export function categoryEntry(line: StatLine, key: CategoryKey): CategoryEntry {
  const field = isShootingCategory(key) ? (key === "fgPct" ? line.fg : line.ft) : line[key];
  if (field.kind !== "value") {
    return { kind: field.kind };
  }
  if (typeof field.value === "number") {
    return { kind: "value", value: field.value, shots: null };
  }
  const shots = field.value;
  return { kind: "value", value: percentage(shots.makes, shots.attempts), shots };
}

/**
 * The category the board opens on: the lost category closest to turning,
 * measured relative to the larger side. With no lost category, the first one.
 */
export function closestLostCategory(comparison: TotalsComparison): CategoryKey {
  let best: CategoryKey = CATEGORIES[0];
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

/** The number a column sorts on: attempts for shooting (volume decides the percentage), else the value. */
function sortValue(entry: CategoryEntry): number {
  if (entry.kind !== "value") {
    return 0;
  }
  return entry.shots ? entry.shots.attempts : (entry.value ?? 0);
}

/**
 * One team's column ordered for a category: counted slots before bench and
 * IL, players who played before the rest, then best first (fewest turnovers,
 * most attempts for FG% and FT%). Equal players keep their roster order.
 */
export function orderForCategory<T extends ColumnPlayer>(
  players: readonly T[],
  key: CategoryKey
): T[] {
  const lowerIsBetter = CATEGORY_DIRECTIONS[key] === "lower";
  const keyed = players.map((player, index) => {
    const entry = categoryEntry(player.line, key);
    return {
      player,
      index,
      group: player.isStartingSlot ? 0 : 1,
      shown: APPEARANCE_ORDER[appearance(player.line)],
      value: sortValue(entry),
    };
  });
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
  key: CategoryKey,
  entry: CategoryEntry,
  average: CategoryValues | null,
  isStartingSlot: boolean,
  gameIsLive: boolean
): VersusAverage {
  if (!isStartingSlot || entry.kind !== "value" || average === null) {
    return "unavailable";
  }
  const result = versusAverage(key, entry.value, average[key]);
  return result === "worse" && gameIsLive ? "usual" : result;
}
