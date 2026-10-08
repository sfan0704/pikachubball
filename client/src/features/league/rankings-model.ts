import {
  CATEGORIES,
  categoryValue,
  heatmap,
  rankings,
  type CategoryKey,
  type RankedTeam,
  type TeamTable,
} from "@shared/domain";
import { formatTotal, UNAVAILABLE } from "./categories";

export type RankingsMode = "ranks" | "totals";
export type SortKey = CategoryKey | "sum";
export type SortDirection = "asc" | "desc";

/** How good a rank is relative to the league; carried by text as well as colour. */
export type Tone = "good" | "middle" | "poor" | "unknown";

export interface RankingsCell {
  readonly key: CategoryKey;
  readonly rank: number | null;
  readonly text: string;
  readonly tone: Tone;
}

export interface RankingsRow {
  readonly teamKey: string;
  readonly teamName: string;
  readonly managerName: string | null;
  readonly position: number | null;
  readonly isMine: boolean;
  readonly sumText: string;
  readonly cells: readonly RankingsCell[];
}

/** The direction a column sorts first: best at the top. */
export function defaultDirection(mode: RankingsMode, key: SortKey): SortDirection {
  return mode === "totals" && key !== "sum" && key !== "to" ? "desc" : "asc";
}

function toneOf(rank: number | null, teams: number): Tone {
  if (rank === null) {
    return "unknown";
  }
  const share = rank / teams;
  return share <= 1 / 3 ? "good" : share <= 2 / 3 ? "middle" : "poor";
}

function sortValue(
  team: RankedTeam,
  table: TeamTable,
  mode: RankingsMode,
  key: SortKey
): number | null {
  if (key === "sum") {
    return team.rankSum;
  }
  if (mode === "ranks") {
    return team.categoryRanks[key];
  }
  const row = table.teams.find((candidate) => candidate.teamKey === team.teamKey);
  return row ? categoryValue(row.totals, key) : null;
}

/** Rows for the rankings table, sorted; teams with an unknown sort value go last whichever way it sorts. */
export function buildRankingsRows(
  table: TeamTable,
  myTeamKey: string,
  mode: RankingsMode,
  sort: { key: SortKey; direction: SortDirection }
): RankingsRow[] {
  const ranked = rankings(table);
  const sorted = ranked
    .map((team, index) => ({ team, index, value: sortValue(team, table, mode, sort.key) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1;
      }
      const difference = sort.direction === "asc" ? a.value - b.value : b.value - a.value;
      return difference || a.index - b.index;
    });

  const totalsByTeam = new Map(table.teams.map((row) => [row.teamKey, row.totals]));
  return sorted.flatMap(({ team }) => {
    const totals = totalsByTeam.get(team.teamKey);
    if (!totals) {
      return [];
    }
    return {
      teamKey: team.teamKey,
      teamName: team.teamName,
      managerName: team.managerName,
      position: team.position,
      isMine: team.teamKey === myTeamKey,
      sumText: team.rankSum === null ? UNAVAILABLE : String(team.rankSum),
      cells: CATEGORIES.map((key) => {
        const rank = team.categoryRanks[key];
        return {
          key,
          rank,
          text:
            mode === "ranks"
              ? rank === null
                ? UNAVAILABLE
                : String(rank)
              : formatTotal(totals, key, true),
          tone: toneOf(rank, table.teams.length),
        };
      }),
    };
  });
}

export interface HeatmapRowModel {
  readonly teamKey: string;
  readonly teamName: string;
  readonly isMine: boolean;
  readonly cells: readonly {
    readonly key: CategoryKey;
    readonly text: string;
    readonly rank: number | null;
    /** 0 to 1, how strongly to shade the cell; 0 when unranked. */
    readonly intensity: number;
  }[];
}

/** Heatmap rows in ranking order, each cell showing the total and its rank. */
export function buildHeatmapRows(table: TeamTable, myTeamKey: string): HeatmapRowModel[] {
  const cellsByTeam = new Map(heatmap(table).map((row) => [row.teamKey, row]));
  const totalsByTeam = new Map(table.teams.map((row) => [row.teamKey, row.totals]));
  return rankings(table).flatMap((team) => {
    const row = cellsByTeam.get(team.teamKey);
    const totals = totalsByTeam.get(team.teamKey);
    if (!row || !totals) {
      return [];
    }
    return {
      teamKey: team.teamKey,
      teamName: team.teamName,
      isMine: team.teamKey === myTeamKey,
      cells: CATEGORIES.map((key) => {
        const { rank, percentile } = row.cells[key];
        return { key, text: formatTotal(totals, key), rank, intensity: (percentile ?? 0) / 100 };
      }),
    };
  });
}
