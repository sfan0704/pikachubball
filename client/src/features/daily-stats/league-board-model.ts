import { categoryRanks, type TeamCategoryValues, type TeamTable } from "@shared/domain";
import { categoryLabel, formatTotal } from "@/features/league/categories";

/** How a rank reads against the league: top three, bottom three, or neither. */
export type RankTone = "top" | "bottom" | "none";

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

/** A team's rank and total in each of the league's categories, in the league's order. */
export function teamCells(table: TeamTable, teamKey: string): BoardCell[] {
  const ranks = categoryRanks(table)[teamKey] ?? {};
  const team = table.teams.find((row) => row.teamKey === teamKey);
  return table.settings.categories.map((category) => {
    const rank = ranks[category.statId] ?? null;
    return {
      statId: category.statId,
      label: categoryLabel(category),
      rank,
      tone: rankTone(rank, table.teams.length),
      text: formatTotal(category, team?.categoryValues[category.statId] ?? null),
    };
  });
}
