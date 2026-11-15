import {
  luckSteps,
  officialWeekRecords,
  seasonAllPlay,
  weeklyAllPlay,
  winPercentageRanks,
  type AllPlayTable,
  type TeamRecord,
  type TeamTable,
} from "@shared/domain";
import type { StandingsSort } from "@/features/league/league-board-state";
import { UNAVAILABLE } from "@/features/league/categories";
import { rankTone, teamValues, type RankTone } from "./league-board-model";

/** One team in the Standings table. */
export interface StandingsRow {
  readonly teamKey: string;
  readonly teamName: string;
  readonly isMine: boolean;
  /** The official place, by record win % (a tie counts as half); null without a record. */
  readonly rank: number | null;
  readonly tone: RankTone;
  /** The official category record as W–L–T. */
  readonly record: string;
  /** The place by all-play win %; null until all-play is known or when the team has none. */
  readonly allPlayRank: number | null;
  readonly allPlayTone: RankTone;
  /** Real category wins minus the wins all-play expects; null when either side is unknown. */
  readonly luck: number | null;
}

/** A record as W–L–T; unavailable when there is none. */
export function recordText(record: TeamRecord | undefined): string {
  return record === undefined ? UNAVAILABLE : `${record.wins}–${record.losses}–${record.ties}`;
}

/**
 * Each team's official category record for the table's period: Yahoo's
 * standings for the season, or the week's results against the real opponent.
 * Teams without one (no standings, a bye) are left out.
 */
export function officialRecords(table: TeamTable): Readonly<Record<string, TeamRecord>> {
  if (table.scope.kind === "week") {
    return officialWeekRecords(table.settings.categories, teamValues(table), table.pairings);
  }
  return Object.fromEntries(
    table.teams.flatMap((team) => (team.record === null ? [] : [[team.teamKey, team.record]]))
  );
}

/** One week's all-play from that week's table. */
export function weekAllPlay(table: TeamTable): AllPlayTable {
  return weeklyAllPlay(table.settings.categories, teamValues(table));
}

/** The season's all-play: every week's table played out, then added up (method A). */
export function seasonAllPlayOf(weeks: readonly TeamTable[]): AllPlayTable {
  return seasonAllPlay(weeks.map(weekAllPlay));
}

function allPlayRanks(allPlay: AllPlayTable | null): Readonly<Record<string, number | null>> {
  if (allPlay === null) {
    return {};
  }
  return winPercentageRanks(
    Object.fromEntries(Object.entries(allPlay).map(([teamKey, record]) => [teamKey, record.total]))
  );
}

function luckOf(official: TeamRecord | undefined, allPlay: AllPlayTable | null, teamKey: string) {
  const strength = allPlay?.[teamKey];
  if (official === undefined || strength === undefined) {
    return null;
  }
  return luckSteps(official, strength.total)?.luck ?? null;
}

/** Lower is better for ranks; higher is better for luck. Unknown values always go last. */
function sortValue(row: StandingsRow, sort: StandingsSort): number {
  const value = { record: row.rank, "all-play": row.allPlayRank, luck: row.luck }[sort];
  if (value === null) {
    return Number.POSITIVE_INFINITY;
  }
  return sort === "luck" ? -value : value;
}

/**
 * The Standings table: every team with its official place and record, its
 * all-play place and its luck, ordered by the chosen column. Ties keep the
 * official order, then Yahoo's team order. Pass a null all-play while it loads.
 */
export function standingsRows(
  table: TeamTable,
  myTeamKey: string,
  allPlay: AllPlayTable | null,
  sort: StandingsSort
): StandingsRow[] {
  const count = table.teams.length;
  const official = officialRecords(table);
  const ranks = winPercentageRanks(official);
  const apRanks = allPlayRanks(allPlay);
  const rows = table.teams.map((team) => {
    const rank = ranks[team.teamKey] ?? null;
    const allPlayRank = apRanks[team.teamKey] ?? null;
    return {
      teamKey: team.teamKey,
      teamName: team.teamName,
      isMine: team.teamKey === myTeamKey,
      rank,
      tone: rankTone(rank, count),
      record: recordText(official[team.teamKey]),
      allPlayRank,
      allPlayTone: rankTone(allPlayRank, count),
      luck: luckOf(official[team.teamKey], allPlay, team.teamKey),
    };
  });
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        sortValue(a.row, sort) - sortValue(b.row, sort) ||
        sortValue(a.row, "record") - sortValue(b.row, "record") ||
        a.index - b.index
    )
    .map(({ row }) => row);
}

/** Luck to one decimal with its sign ("+2.3", "−1.0"), and a plain "0" when it rounds to nothing. */
export function luckText(luck: number): string {
  const rounded = Math.round(luck * 10) / 10;
  if (rounded === 0) {
    return "0";
  }
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

/** A place as an ordinal: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(place: number): string {
  const teen = place % 100 >= 11 && place % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `${place}${suffix}`;
}
