import {
  CATEGORIES,
  categoryRanks,
  rankings,
  type CategoryKey,
  type TeamRecord,
  type TeamTable,
} from "@shared/domain";
import { CATEGORY_LABELS, formatTotal, UNAVAILABLE } from "@/features/league/categories";

/** What the tiles select: the overall order or one category. */
export type BoardPick = "overall" | CategoryKey;

/** How a rank reads against the league: top three, bottom three, or neither. */
export type RankTone = "top" | "bottom" | "none";

/** The season records by team; null until the standings have loaded. */
export type Records = ReadonlyMap<string, TeamRecord | null> | null;

/** One category of a team: its rank and total. */
export interface BoardCell {
  readonly key: CategoryKey;
  readonly label: string;
  readonly rank: number | null;
  readonly tone: RankTone;
  readonly text: string;
}

/** One tile: the user's rank overall or in a category. */
export interface BoardTile {
  readonly pick: BoardPick;
  readonly label: string;
  readonly rank: number | null;
  readonly tone: RankTone;
}

/** One team in the list below the tiles. */
export interface BoardRow {
  readonly teamKey: string;
  readonly teamName: string;
  readonly isMine: boolean;
  readonly rank: number | null;
  readonly tone: RankTone;
  /** The record on the Overall list, the category total otherwise. */
  readonly value: string;
  /** The nine categories, on the Overall list only. */
  readonly cells: readonly BoardCell[] | null;
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

/** Yahoo's record as W–L–T; unavailable when the standings didn't give it, blank while loading. */
export function recordText(records: Records, teamKey: string): string {
  if (records === null) {
    return "";
  }
  const record = records.get(teamKey) ?? null;
  return record === null ? UNAVAILABLE : `${record.wins}–${record.losses}–${record.ties}`;
}

/** A team's rank and total in each of the nine categories. */
export function teamCells(table: TeamTable, teamKey: string): BoardCell[] {
  const ranks = categoryRanks(table)[teamKey];
  const team = table.teams.find((row) => row.teamKey === teamKey);
  return CATEGORIES.map((key) => {
    const rank = ranks?.[key] ?? null;
    return {
      key,
      label: CATEGORY_LABELS[key],
      rank,
      tone: rankTone(rank, table.teams.length),
      text: team ? formatTotal(team.totals, key) : UNAVAILABLE,
    };
  });
}

/** The ten tiles: the user's overall place, then their rank in each category. */
export function boardTiles(table: TeamTable, myTeamKey: string): BoardTile[] {
  const count = table.teams.length;
  const position = rankings(table).find((team) => team.teamKey === myTeamKey)?.position ?? null;
  return [
    { pick: "overall", label: "Overall", rank: position, tone: rankTone(position, count) },
    ...teamCells(table, myTeamKey).map((cell) => ({
      pick: cell.key,
      label: cell.label,
      rank: cell.rank,
      tone: cell.tone,
    })),
  ];
}

function overallRows(table: TeamTable, myTeamKey: string, records: Records): BoardRow[] {
  return rankings(table).map((team) => ({
    teamKey: team.teamKey,
    teamName: team.teamName,
    isMine: team.teamKey === myTeamKey,
    rank: team.position,
    tone: rankTone(team.position, table.teams.length),
    value: recordText(records, team.teamKey),
    cells: teamCells(table, team.teamKey),
  }));
}

function categoryRows(table: TeamTable, myTeamKey: string, key: CategoryKey): BoardRow[] {
  const ranks = categoryRanks(table);
  const byRank = (rank: number | null) => rank ?? Number.POSITIVE_INFINITY;
  return table.teams
    .map((team, index) => ({ team, index, rank: ranks[team.teamKey]?.[key] ?? null }))
    .sort((a, b) => byRank(a.rank) - byRank(b.rank) || a.index - b.index)
    .map(({ team, rank }) => ({
      teamKey: team.teamKey,
      teamName: team.teamName,
      isMine: team.teamKey === myTeamKey,
      rank,
      tone: rankTone(rank, table.teams.length),
      value: formatTotal(team.totals, key),
      cells: null,
    }));
}

/**
 * The list the selected tile shows: every team by strength (sum of its nine
 * ranks) with its record and totals, or every team ranked in one category.
 * Tied teams share a rank; unranked teams go last.
 */
export function boardRows(
  table: TeamTable,
  myTeamKey: string,
  pick: BoardPick,
  records: Records
): BoardRow[] {
  return pick === "overall"
    ? overallRows(table, myTeamKey, records)
    : categoryRows(table, myTeamKey, pick);
}
