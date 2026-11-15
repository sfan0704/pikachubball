import { winPercentageRanks, type LeagueCategory, type TeamTable } from "@shared/domain";
import { categoryRankTable, categoryText, rankTone, type RankTone } from "./league-board-model";
import { officialRecords } from "./league-standings-model";

/** One rank in the grid. */
export interface GridCell {
  readonly statId: string;
  readonly rank: number | null;
  readonly tone: RankTone;
  readonly picked: boolean;
}

/** One team's line in the grid: its ranks, and its total in the picked category. */
export interface GridRow {
  readonly teamKey: string;
  readonly teamName: string;
  readonly isMine: boolean;
  /** The total in the picked category; null when no category is picked. */
  readonly total: string | null;
  readonly cells: readonly GridCell[];
}

/** The Categories view: a column per league category and a row per team. */
export interface CategoryGrid {
  readonly categories: readonly LeagueCategory[];
  /** The category the rows are sorted by, when the picked stat id is one of the league's. */
  readonly picked: LeagueCategory | null;
  readonly rows: readonly GridRow[];
}

const last = (rank: number | null | undefined) => rank ?? Number.POSITIVE_INFINITY;

/**
 * Every team's rank in each of the league's categories. With a category
 * picked, teams are ordered by that rank and show its total; otherwise they
 * keep the official standings order. Ties keep the standings order.
 */
export function categoryGrid(
  table: TeamTable,
  myTeamKey: string,
  pickedStatId: string | null
): CategoryGrid {
  const { categories } = table.settings;
  const picked = categories.find((category) => category.statId === pickedStatId) ?? null;
  const ranks = categoryRankTable(table);
  const official = winPercentageRanks(officialRecords(table));
  const count = table.teams.length;
  const rows = table.teams.map((team, index) => ({
    index,
    pickedRank: picked ? ranks[team.teamKey][picked.statId] : null,
    officialRank: official[team.teamKey],
    row: {
      teamKey: team.teamKey,
      teamName: team.teamName,
      isMine: team.teamKey === myTeamKey,
      total: picked ? categoryText(picked, team.categoryValues[picked.statId]) : null,
      cells: categories.map((category) => {
        const rank = ranks[team.teamKey][category.statId];
        return {
          statId: category.statId,
          rank,
          tone: rankTone(rank, count),
          picked: category === picked,
        };
      }),
    },
  }));
  rows.sort(
    (a, b) =>
      last(a.pickedRank) - last(b.pickedRank) ||
      last(a.officialRank) - last(b.officialRank) ||
      a.index - b.index
  );
  return { categories, picked, rows: rows.map(({ row }) => row) };
}
