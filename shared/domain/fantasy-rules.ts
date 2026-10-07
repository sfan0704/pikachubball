import { CATEGORIES, type CategoryKey } from "./stats";
import type { CategoryDirection, LeagueSettings, TeamTable, TeamTotals } from "./team-table";

/** The direction of each of the nine standard categories. */
export const CATEGORY_DIRECTIONS: Readonly<Record<CategoryKey, CategoryDirection>> = {
  fgPct: "higher",
  ftPct: "higher",
  tpm: "higher",
  pts: "higher",
  reb: "higher",
  ast: "higher",
  stl: "higher",
  blk: "higher",
  to: "lower",
};

/** Total makes over total attempts; null when either is unknown or there were no attempts. */
export function percentage(makes: number | null, attempts: number | null): number | null {
  if (makes === null || attempts === null || attempts === 0) {
    return null;
  }
  return makes / attempts;
}

/** A team's value in one category; null when it can't be known. */
export function categoryValue(totals: TeamTotals, key: CategoryKey): number | null {
  switch (key) {
    case "fgPct":
      return percentage(totals.fgMakes, totals.fgAttempts);
    case "ftPct":
      return percentage(totals.ftMakes, totals.ftAttempts);
    default:
      return totals[key];
  }
}

/**
 * Competition ranks (1, 1, 3): equal values share a rank and the next rank
 * is skipped. Unknown values get no rank and don't affect the others.
 */
export function competitionRanks(
  values: readonly (number | null)[],
  direction: CategoryDirection
): (number | null)[] {
  const better = (a: number, b: number) => (direction === "higher" ? a > b : a < b);
  return values.map((value) => {
    if (value === null) {
      return null;
    }
    const betterCount = values.filter((other) => other !== null && better(other, value)).length;
    return betterCount + 1;
  });
}

/** Each team's rank in each category, keyed by team key. */
export type CategoryRanks = Readonly<Record<string, Readonly<Record<CategoryKey, number | null>>>>;

/** Ranks every team in every standard category. */
export function categoryRanks(table: TeamTable): CategoryRanks {
  const ranks: Record<string, Record<CategoryKey, number | null>> = {};
  for (const team of table.teams) {
    ranks[team.teamKey] = {} as Record<CategoryKey, number | null>;
  }
  for (const key of CATEGORIES) {
    const values = table.teams.map((team) => categoryValue(team.totals, key));
    const keyRanks = competitionRanks(values, CATEGORY_DIRECTIONS[key]);
    table.teams.forEach((team, index) => {
      ranks[team.teamKey][key] = keyRanks[index];
    });
  }
  return ranks;
}

/** The sum of a team's category ranks; null when any rank is unknown. Lower is better. */
export function rankSum(ranks: Readonly<Record<CategoryKey, number | null>>): number | null {
  let sum = 0;
  for (const key of CATEGORIES) {
    const rank = ranks[key];
    if (rank === null) {
      return null;
    }
    sum += rank;
  }
  return sum;
}

/** Whether the app can rank a league, and why not when it can't. */
export type ScoringSupport =
  { readonly supported: true } | { readonly supported: false; readonly reason: string };

/** Only head-to-head category leagues with exactly the nine standard categories are supported. */
export function scoringSupport(settings: LeagueSettings): ScoringSupport {
  if (settings.scoringType !== "head") {
    return {
      supported: false,
      reason: `Scoring type "${settings.scoringType}" isn't head-to-head categories`,
    };
  }
  const keys = settings.categories.map((category) => category.key);
  const unknown = settings.categories.filter((category) => category.key === null);
  if (unknown.length > 0) {
    const names = unknown.map((category) => category.displayName).join(", ");
    return { supported: false, reason: `Unsupported categories: ${names}` };
  }
  const missing = CATEGORIES.filter((key) => !keys.includes(key));
  if (missing.length > 0 || keys.length !== CATEGORIES.length) {
    return { supported: false, reason: "The league doesn't use the standard nine categories" };
  }
  const wrongDirection = settings.categories.find(
    (category) => category.key !== null && category.direction !== CATEGORY_DIRECTIONS[category.key]
  );
  if (wrongDirection) {
    return {
      supported: false,
      reason: `${wrongDirection.displayName} is scored in an unexpected direction`,
    };
  }
  return { supported: true };
}
