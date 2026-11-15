import { isPercentage, partsOfAll, type CategoryValues, type StatTotals } from "./categories";
import { percentage } from "./fantasy-rules";
import { appearance, statOf, type StatLine } from "./stat-value";
import type { LeagueCategory, WeekGames } from "./team-table";

/** One player on one team's roster on one date, with that date's line. */
export interface PlayerDay {
  readonly playerKey: string;
  /** US Eastern date, YYYY-MM-DD. */
  readonly date: string;
  /** The roster slot that date, for example "PG", "Util", "BN" or "IL". */
  readonly slot: string;
  /** Whether the slot counts toward the team (Yahoo's is_starting_position); bench and IL don't. */
  readonly isStartingSlot: boolean;
  readonly line: StatLine;
}

function addStat(sum: number | null, line: StatLine, statId: string): number | null {
  const value = statOf(line, statId);
  if (sum === null || value.kind === "unavailable") {
    return null;
  }
  return value.kind === "value" ? sum + value.value : sum;
}

/**
 * Totals that counted for the team: the sum of starting-slot days only, for
 * each stat the league's categories are built from (ratios come from these
 * sums). No game, did not play and not yet played add nothing; an unavailable
 * value makes that stat's total unknown.
 */
export function countedTotals(
  days: readonly PlayerDay[],
  categories: readonly LeagueCategory[]
): StatTotals {
  const counted = days.filter((day) => day.isStartingSlot);
  return Object.fromEntries(
    partsOfAll(categories).map((statId) => [
      statId,
      counted.reduce<number | null>((sum, day) => addStat(sum, day.line, statId), 0),
    ])
  );
}

/**
 * Games that counted: starting-slot days on which the player's team had a game
 * that has been played, including games the player sat out. This is Yahoo's
 * completed_games for a finished week.
 */
export function countedGames(days: readonly PlayerDay[]): number {
  return days.filter((day) => {
    const kind = appearance(day.line);
    return day.isStartingSlot && (kind === "played" || kind === "didNotPlay");
  }).length;
}

/** A player's totals over a period (season, last 7 or last 30 days) with games played. */
export interface PeriodTotals {
  readonly gamesPlayed: number;
  readonly line: StatLine;
}

function measuredStat(line: StatLine, statId: string): number | null {
  const value = statOf(line, statId);
  return value.kind === "value" ? value.value : null;
}

function averageOf(period: PeriodTotals, category: LeagueCategory): number | null {
  const makeup = category.makeup;
  switch (makeup.kind) {
    case "counting": {
      const total = measuredStat(period.line, category.statId);
      return total === null ? null : total / period.gamesPlayed;
    }
    case "ratio":
      return percentage(
        measuredStat(period.line, makeup.topStatId),
        measuredStat(period.line, makeup.bottomStatId)
      );
    case "unavailable":
      return null;
  }
}

/**
 * Per-game averages in each of the league's categories: each counting total
 * divided by games played, and a ratio as total top over total bottom. No
 * games played means no averages; a category the app can't build has none.
 */
export function perGameAverages(
  period: PeriodTotals,
  categories: readonly LeagueCategory[]
): CategoryValues {
  return Object.fromEntries(
    categories.map((category) => [
      category.statId,
      period.gamesPlayed === 0 ? null : averageOf(period, category),
    ])
  );
}

/** How a value compares with what the player's average predicts, already oriented for turnovers. */
export type VersusAverage = "better" | "worse" | "usual" | "unavailable";

/** How far from the baseline a value must be to count as well above or below it. */
export function averageThreshold(category: LeagueCategory, baseline: number): number {
  if (isPercentage(category)) {
    return 0.03;
  }
  const floor = category.makeup.kind === "ratio" ? 0.1 : 0.5;
  return Math.max(floor, Math.abs(baseline) * 0.1);
}

/**
 * Compares a value with its baseline: at least the threshold away is better
 * or worse, in the category's direction (fewer turnovers is better). Unknown either side is unavailable.
 */
export function versusAverage(
  category: LeagueCategory,
  value: number | null,
  baseline: number | null
): VersusAverage {
  if (value === null || baseline === null) {
    return "unavailable";
  }
  const difference = value - baseline;
  // The tolerance keeps float noise (.538 - .508) from deciding a value exactly at the threshold.
  if (Math.abs(difference) + 1e-9 < averageThreshold(category, baseline)) {
    return "usual";
  }
  const higherIsBetter = category.direction === "higher";
  return difference > 0 === higherIsBetter ? "better" : "worse";
}

/** Games played and the week's total, shown as played/total (for example 19/41) as Yahoo does. */
export interface GamesPlayed {
  readonly played: number;
  readonly total: number;
}

/**
 * Played is Yahoo's completed games plus live ones, since a started game has
 * counted; the total adds the remaining ones.
 */
export function gamesPlayed(games: WeekGames): GamesPlayed {
  const played = games.completed + games.live;
  return { played, total: played + games.remaining };
}
