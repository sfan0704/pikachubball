import {
  competitionRanks,
  type LeagueCategory,
  type TeamCategoryValues,
  type TeamTable,
} from "@shared/domain";
import { UNAVAILABLE } from "@/features/league/categories";

/** How a rank reads against the league: top three, bottom three, or neither. */
export type RankTone = "top" | "bottom" | "none";

/** Each team's rank in each of the league's categories: team key, then stat id. */
export type CategoryRankTable = Readonly<Record<string, Readonly<Record<string, number | null>>>>;

/** One category of a team: its rank and total. */
export interface BoardCell {
  readonly statId: string;
  readonly label: string;
  readonly rank: number | null;
  readonly tone: RankTone;
  readonly text: string;
}

/** Green for the top three and red for the bottom three, whatever the league's size. */
export function rankTone(rank: number | null, teamCount: number): RankTone {
  if (rank === null) {
    return "none";
  }
  if (rank <= 3) {
    return "top";
  }
  return rank > teamCount - 3 ? "bottom" : "none";
}

/** Each team's values in the league's own categories, as the League maths takes them. */
export function teamValues(table: TeamTable): TeamCategoryValues[] {
  return table.teams.map((team) => ({ teamKey: team.teamKey, values: team.categoryValues }));
}

/**
 * Every team ranked in every one of the league's categories, from Yahoo's own
 * values. Tied teams share a rank (1, 1, 3); an unknown value gets no rank.
 */
export function categoryRankTable(table: TeamTable): CategoryRankTable {
  const ranks: Record<string, Record<string, number | null>> = Object.fromEntries(
    table.teams.map((team) => [team.teamKey, {}])
  );
  for (const category of table.settings.categories) {
    const values = table.teams.map((team) => team.categoryValues[category.statId] ?? null);
    competitionRanks(values, category.direction).forEach((rank, index) => {
      ranks[table.teams[index].teamKey][category.statId] = rank;
    });
  }
  return ranks;
}

/**
 * A category value as text: a percentage to one decimal ("47.9%") when the
 * category is one, otherwise Yahoo's number as given. Unknown reads as unavailable.
 */
export function categoryText(category: LeagueCategory, value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return UNAVAILABLE;
  }
  return category.displayName.includes("%") ? `${(value * 100).toFixed(1)}%` : String(value);
}

/** A team's rank and total in each of the league's categories, in the league's order. */
export function teamCells(table: TeamTable, teamKey: string): BoardCell[] {
  const ranks = categoryRankTable(table)[teamKey] ?? {};
  const team = table.teams.find((row) => row.teamKey === teamKey);
  return table.settings.categories.map((category) => {
    const rank = ranks[category.statId] ?? null;
    return {
      statId: category.statId,
      label: category.displayName,
      rank,
      tone: rankTone(rank, table.teams.length),
      text: categoryText(category, team?.categoryValues[category.statId]),
    };
  });
}
