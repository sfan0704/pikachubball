import type { CategoryValues } from "./categories";
import { categoryRanks, competitionRanks, rankSum } from "./fantasy-rules";
import type { LeagueCategory, MatchupPairing, TeamTable } from "./team-table";

/** One team's line in the rankings. */
export interface RankedTeam {
  readonly teamKey: string;
  readonly teamName: string;
  readonly managerName: string | null;
  /** Rank in each category, by stat id; null where the team's value is unknown. */
  readonly categoryRanks: Readonly<Record<string, number | null>>;
  /** Sum of category ranks, lower is better; null when any rank is unknown. */
  readonly rankSum: number | null;
  /** Place by rank sum (1, 1, 3 for ties); null when the sum is unknown. */
  readonly position: number | null;
}

/**
 * Teams ordered by rank sum, best first. Teams whose sum is unknown go last,
 * and equal sums keep the table's order.
 */
export function rankings(table: TeamTable): RankedTeam[] {
  const ranks = categoryRanks(table);
  const sums = table.teams.map((team) => rankSum(ranks[team.teamKey]));
  const positions = competitionRanks(sums, "lower");
  const ranked = table.teams.map((team, index) => ({
    teamKey: team.teamKey,
    teamName: team.teamName,
    managerName: team.managerName,
    categoryRanks: ranks[team.teamKey],
    rankSum: sums[index],
    position: positions[index],
  }));
  return ranked
    .map((team, index) => ({ team, index }))
    .sort((a, b) => compareSums(a.team.rankSum, b.team.rankSum) || a.index - b.index)
    .map(({ team }) => team);
}

function compareSums(a: number | null, b: number | null): number {
  if (a === null || b === null) {
    return a === b ? 0 : a === null ? 1 : -1;
  }
  return a - b;
}

/** Who won a category. "unavailable" means a value is unknown, so no result is claimed. */
export type CategoryResult = "win" | "loss" | "tie" | "unavailable";

/** One category of a head-to-head, from my team's side. */
export interface CategoryComparison {
  readonly category: LeagueCategory;
  readonly mine: number | null;
  readonly theirs: number | null;
  /** mine minus theirs, unoriented: for turnovers a negative number is good. */
  readonly difference: number | null;
  readonly result: CategoryResult;
}

/** The tally of a head-to-head. */
export interface Score {
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly unavailable: number;
  /** True only when every category has a result, so a full W-L-T claim is safe. */
  readonly complete: boolean;
}

function compareCategory(mine: number | null, theirs: number | null, category: LeagueCategory) {
  if (mine === null || theirs === null) {
    return "unavailable" as const;
  }
  if (mine === theirs) {
    return "tie" as const;
  }
  const higherIsBetter = category.direction === "higher";
  return mine > theirs === higherIsBetter ? ("win" as const) : ("loss" as const);
}

function tally(categories: readonly CategoryComparison[]): Score {
  const count = (result: CategoryResult) => categories.filter((c) => c.result === result).length;
  const unavailable = count("unavailable");
  return {
    wins: count("win"),
    losses: count("loss"),
    ties: count("tie"),
    unavailable,
    complete: unavailable === 0,
  };
}

/** Two sets of totals compared category by category, from my side. */
export interface TotalsComparison {
  readonly categories: readonly CategoryComparison[];
  readonly score: Score;
}

/**
 * Compares my values with theirs in each of the league's categories. Ratios
 * must already be exact (summed top over summed bottom), so equal rounded
 * percentages don't hide a winner. An unknown value is never a win, loss or
 * tie; in values the app combines itself, that includes every category it
 * can't build.
 */
export function compareCategories(
  categories: readonly LeagueCategory[],
  mine: CategoryValues,
  theirs: CategoryValues
): TotalsComparison {
  const compared = categories.map((category): CategoryComparison => {
    const myValue = mine[category.statId] ?? null;
    const theirValue = theirs[category.statId] ?? null;
    return {
      category,
      mine: myValue,
      theirs: theirValue,
      difference: myValue === null || theirValue === null ? null : myValue - theirValue,
      result: compareCategory(myValue, theirValue, category),
    };
  });
  return { categories: compared, score: tally(compared) };
}

function pairingOf(table: TeamTable, teamKey: string): MatchupPairing | undefined {
  return table.pairings.find((pairing) => pairing.teamKeys.includes(teamKey));
}

/** The team my team plays this week, from Yahoo's pairings; null if it has no pairing. */
export function opponentOf(table: TeamTable, myTeamKey: string): string | null {
  const pairing = pairingOf(table, myTeamKey);
  return pairing?.teamKeys.find((key) => key !== myTeamKey) ?? null;
}
