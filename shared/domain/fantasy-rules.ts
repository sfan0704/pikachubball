import type { CategoryDirection, LeagueSettings, TeamTable } from "./team-table";

/** Total makes over total attempts; null when either is unknown or there were no attempts. */
export function percentage(makes: number | null, attempts: number | null): number | null {
  if (makes === null || attempts === null || attempts === 0) {
    return null;
  }
  return makes / attempts;
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

/** Each team's rank in each category (by stat id), keyed by team key. */
export type CategoryRanks = Readonly<Record<string, Readonly<Record<string, number | null>>>>;

/** Ranks every team in each of the league's categories, on Yahoo's own values. */
export function categoryRanks(table: TeamTable): CategoryRanks {
  const ranks: Record<string, Record<string, number | null>> = {};
  for (const team of table.teams) {
    ranks[team.teamKey] = {};
  }
  for (const category of table.settings.categories) {
    const values = table.teams.map((team) => team.categoryValues[category.statId] ?? null);
    const keyRanks = competitionRanks(values, category.direction);
    table.teams.forEach((team, index) => {
      ranks[team.teamKey][category.statId] = keyRanks[index];
    });
  }
  return ranks;
}

/** Whether the app can rank a league, and why not when it can't. */
export type ScoringSupport =
  { readonly supported: true } | { readonly supported: false; readonly reason: string };

/**
 * Only head-to-head category leagues are supported. Any set of categories is:
 * one the app can't build is marked unavailable for combined views, never refused.
 */
export function scoringSupport(settings: LeagueSettings): ScoringSupport {
  if (settings.scoringType !== "head") {
    return {
      supported: false,
      reason: `Scoring type "${settings.scoringType}" isn't head-to-head categories`,
    };
  }
  return { supported: true };
}

/** How much of a table Yahoo has stats for. */
export type TableCompleteness = "empty" | "partial" | "complete";

/**
 * "empty" when no team has any recorded stat (a preseason league: every value
 * is zero or unknown), "partial" when some value is unknown, else "complete".
 * Only the league's own categories count, so a stat it doesn't score never
 * makes a table partial. Unknown stays unknown: it is never counted as a zero.
 */
export function tableCompleteness(table: TeamTable): TableCompleteness {
  const values = table.teams.flatMap((team) => Object.values(team.categoryValues));
  if (values.every((value) => value === null || value === 0)) {
    return "empty";
  }
  return values.some((value) => value === null) ? "partial" : "complete";
}
