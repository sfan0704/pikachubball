import {
  CATEGORY_DIRECTIONS,
  categoryRanks,
  categoryValue,
  competitionRanks,
  rankSum,
} from "./fantasy-rules";
import { CATEGORIES, type CategoryKey } from "./stats";
import type { MatchupPairing, TeamTable, TeamTotals } from "./team-table";

/** One team's line in the rankings. */
export interface RankedTeam {
  readonly teamKey: string;
  readonly teamName: string;
  readonly managerName: string | null;
  /** Rank in each category; null where the team's value is unknown. */
  readonly categoryRanks: Readonly<Record<CategoryKey, number | null>>;
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
  readonly category: CategoryKey;
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

function compareCategory(mine: number | null, theirs: number | null, key: CategoryKey) {
  if (mine === null || theirs === null) {
    return "unavailable" as const;
  }
  if (mine === theirs) {
    return "tie" as const;
  }
  const higherIsBetter = CATEGORY_DIRECTIONS[key] === "higher";
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
 * Compares my totals with theirs. FG% and FT% compare exact makes over
 * attempts, so equal rounded percentages don't hide a winner.
 */
export function compareTotals(mine: TeamTotals, theirs: TeamTotals): TotalsComparison {
  const categories = CATEGORIES.map((key): CategoryComparison => {
    const myValue = categoryValue(mine, key);
    const theirValue = categoryValue(theirs, key);
    return {
      category: key,
      mine: myValue,
      theirs: theirValue,
      difference: myValue === null || theirValue === null ? null : myValue - theirValue,
      result: compareCategory(myValue, theirValue, key),
    };
  });
  return { categories, score: tally(categories) };
}

function pairingOf(table: TeamTable, teamKey: string): MatchupPairing | undefined {
  return table.pairings.find((pairing) => pairing.teamKeys.includes(teamKey));
}

/** The team my team plays this week, from Yahoo's pairings; null if it has no pairing. */
export function opponentOf(table: TeamTable, myTeamKey: string): string | null {
  const pairing = pairingOf(table, myTeamKey);
  return pairing?.teamKeys.find((key) => key !== myTeamKey) ?? null;
}
