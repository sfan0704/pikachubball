import { CATEGORY_DIRECTIONS, percentage } from "./fantasy-rules";
import { CATEGORIES, type CategoryKey } from "./stats";
import {
  appearance,
  COUNT_FIELDS,
  type CountValue,
  type ShotValue,
  type StatLine,
} from "./stat-value";
import type { TeamTotals, WeekGames } from "./team-table";

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

/** Running sum of one field; null once any counted value is unavailable. */
type Sum = number | null;

function addCount(sum: Sum, value: CountValue): Sum {
  if (sum === null || value.kind === "unavailable") {
    return null;
  }
  return value.kind === "value" ? sum + value.value : sum;
}

function addShots(sum: readonly [Sum, Sum], value: ShotValue): readonly [Sum, Sum] {
  const [makes, attempts] = sum;
  if (makes === null || attempts === null || value.kind === "unavailable") {
    return [null, null];
  }
  if (value.kind !== "value") {
    return sum;
  }
  return [makes + value.value.makes, attempts + value.value.attempts];
}

function emptyTotals(): TeamTotals {
  return {
    fgMakes: 0,
    fgAttempts: 0,
    ftMakes: 0,
    ftAttempts: 0,
    tpm: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
  };
}

function addLine(totals: TeamTotals, line: StatLine): TeamTotals {
  const [fgMakes, fgAttempts] = addShots([totals.fgMakes, totals.fgAttempts], line.fg);
  const [ftMakes, ftAttempts] = addShots([totals.ftMakes, totals.ftAttempts], line.ft);
  const counts = Object.fromEntries(
    COUNT_FIELDS.map((field) => [field, addCount(totals[field], line[field])])
  ) as Pick<TeamTotals, (typeof COUNT_FIELDS)[number]>;
  return { ...counts, fgMakes, fgAttempts, ftMakes, ftAttempts };
}

/**
 * Totals that counted for the team: the sum of starting-slot days only. FG% and
 * FT% come from the summed makes and attempts. No game, did not play and not yet
 * played add nothing; an unavailable value makes that category's total unknown.
 */
export function countedTotals(days: readonly PlayerDay[]): TeamTotals {
  return days
    .filter((day) => day.isStartingSlot)
    .reduce((totals, day) => addLine(totals, day.line), emptyTotals());
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

/** A value per category; null where it can't be known. */
export type CategoryValues = Readonly<Record<CategoryKey, number | null>>;

function shotPercentage(value: ShotValue): number | null {
  return value.kind === "value" ? percentage(value.value.makes, value.value.attempts) : null;
}

function noValues(): CategoryValues {
  return Object.fromEntries(CATEGORIES.map((key) => [key, null])) as CategoryValues;
}

/**
 * Per-game averages: each counting total divided by games played, and FG% and
 * FT% as total makes over total attempts. No games played means no averages.
 */
export function perGameAverages(period: PeriodTotals): CategoryValues {
  if (period.gamesPlayed === 0) {
    return noValues();
  }
  const perGame = (value: CountValue) =>
    value.kind === "value" ? value.value / period.gamesPlayed : null;
  return {
    fgPct: shotPercentage(period.line.fg),
    ftPct: shotPercentage(period.line.ft),
    tpm: perGame(period.line.tpm),
    pts: perGame(period.line.pts),
    reb: perGame(period.line.reb),
    ast: perGame(period.line.ast),
    stl: perGame(period.line.stl),
    blk: perGame(period.line.blk),
    to: perGame(period.line.to),
  };
}

/**
 * What a player's averages predict over a number of games: counting stats
 * scale with games, percentages don't. One game is the daily baseline; the
 * games that counted give the week's.
 */
export function expectedOver(averages: CategoryValues, games: number): CategoryValues {
  return Object.fromEntries(
    CATEGORIES.map((key) => {
      const value = averages[key];
      const isPercentage = key === "fgPct" || key === "ftPct";
      return [key, value === null || isPercentage ? value : value * games];
    })
  ) as CategoryValues;
}

/** How a value compares with what the player's average predicts, already oriented for turnovers. */
export type VersusAverage = "better" | "worse" | "usual" | "unavailable";

/** How far from the baseline a value must be to count as well above or below it. */
export function averageThreshold(key: CategoryKey, baseline: number): number {
  if (key === "fgPct" || key === "ftPct") {
    return 0.03;
  }
  return Math.max(0.5, Math.abs(baseline) * 0.1);
}

/**
 * Compares a value with its baseline: at least the threshold away is better
 * or worse, where fewer turnovers is better. Unknown either side is unavailable.
 */
export function versusAverage(
  key: CategoryKey,
  value: number | null,
  baseline: number | null
): VersusAverage {
  if (value === null || baseline === null) {
    return "unavailable";
  }
  const difference = value - baseline;
  // The tolerance keeps float noise (.538 - .508) from deciding a value exactly at the threshold.
  if (Math.abs(difference) + 1e-9 < averageThreshold(key, baseline)) {
    return "usual";
  }
  const higherIsBetter = CATEGORY_DIRECTIONS[key] === "higher";
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
