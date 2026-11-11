import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { PlayerListQuery, StatPeriod, TeamDayResponse } from "@shared/api/daily-stats";
import {
  getDraft,
  getGameLogs,
  getPlayerStats,
  getSchedule,
  getTeamDay,
  getTransactions,
  getWeeks,
  listPlayers,
} from "./daily-stats-endpoints";
import { freshQuery } from "./fresh-query";
import { useFreshness } from "./freshness";
import { queryKeys } from "./query-keys";

/** D2: one team's roster and lines on a date; waits until all three are chosen. */
export function useTeamDay(leagueKey: string | null, teamKey: string | null, date: string | null) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.teamDay(leagueKey ?? "", teamKey ?? "", date ?? ""),
      leagueKey !== null && teamKey !== null && date !== null
        ? {
            dataset: { kind: "teamDay", date },
            fetch: (signal) => getTeamDay(leagueKey, teamKey, date, signal),
          }
        : null
    )
  );
}

/** Several dates of D2 for one team, read as one section. */
export interface TeamDays {
  /**
   * The dates that loaded, in date order, once none is still loading; a failed
   * date is left out so the others still show under its error. Undefined while
   * any date loads, or when every date failed.
   */
  readonly data: TeamDayResponse[] | undefined;
  /** The first failure among the dates, if any. */
  readonly error: Error | null;
  /** When the oldest date's data landed, in epoch milliseconds. */
  readonly dataUpdatedAt: number;
  /** Retries the dates that failed. */
  readonly refetch: () => Promise<unknown>;
}

function combineDays(results: UseQueryResult<TeamDayResponse>[]): TeamDays {
  const failed = results.filter((result) => result.error !== null);
  const loaded = results.flatMap((result) => (result.data === undefined ? [] : [result.data]));
  const settled = loaded.length + failed.filter((result) => result.data === undefined).length;
  return {
    data: loaded.length > 0 && settled === results.length ? loaded : undefined,
    error: failed[0]?.error ?? null,
    dataUpdatedAt: Math.min(...results.map((result) => result.dataUpdatedAt)),
    refetch: () => Promise.all(failed.map((result) => result.refetch())),
  };
}

/** D2 for each listed date of one team, one request a date, as the Week view reads it. */
export function useTeamDays(
  leagueKey: string | null,
  teamKey: string | null,
  dates: readonly string[]
): TeamDays {
  const freshness = useFreshness();
  return useQueries({
    queries: dates.map((date) =>
      freshQuery(
        freshness,
        queryKeys.teamDay(leagueKey ?? "", teamKey ?? "", date),
        leagueKey !== null && teamKey !== null
          ? {
              dataset: { kind: "teamDay", date },
              fetch: (signal) => getTeamDay(leagueKey, teamKey, date, signal),
            }
          : null
      )
    ),
    combine: combineDays,
  });
}

/** D3: game logs for the listed players; waits for at least one player. */
export function useGameLogs(leagueKey: string | null, players: readonly string[]) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.gameLogs(leagueKey ?? "", players),
      leagueKey !== null && players.length > 0
        ? {
            dataset: { kind: "gameLogs" },
            fetch: (signal) => getGameLogs(leagueKey, [...players].sort(), signal),
          }
        : null
    )
  );
}

/** D4: the listed players' totals for a period; waits for at least one player. */
export function usePlayerStats(
  leagueKey: string | null,
  period: StatPeriod,
  players: readonly string[]
) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.playerStats(leagueKey ?? "", period, players),
      leagueKey !== null && players.length > 0
        ? {
            dataset: { kind: "playerStats" },
            fetch: (signal) => getPlayerStats(leagueKey, period, [...players].sort(), signal),
          }
        : null
    )
  );
}

/** D5: one page of the league's player pool. */
export function usePlayerList(leagueKey: string | null, query: PlayerListQuery) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.players(leagueKey ?? "", query),
      leagueKey !== null
        ? {
            dataset: { kind: "playerList" },
            fetch: (signal) => listPlayers(leagueKey, query, signal),
          }
        : null
    )
  );
}

/** D6: every NBA team's games from yesterday (US Eastern) on. */
export function useSchedule(leagueKey: string | null) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.schedule(leagueKey ?? ""),
      leagueKey !== null
        ? { dataset: { kind: "schedule" }, fetch: (signal) => getSchedule(leagueKey, signal) }
        : null
    )
  );
}

/** D7: one team's moves. */
export function useTransactions(leagueKey: string | null, teamKey: string | null) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.transactions(leagueKey ?? "", teamKey ?? ""),
      leagueKey !== null && teamKey !== null
        ? {
            dataset: { kind: "transactions" },
            fetch: (signal) => getTransactions(leagueKey, teamKey, signal),
          }
        : null
    )
  );
}

/** D8: the league's draft results. */
export function useDraft(leagueKey: string | null) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.draft(leagueKey ?? ""),
      leagueKey !== null
        ? { dataset: { kind: "draft" }, fetch: (signal) => getDraft(leagueKey, signal) }
        : null
    )
  );
}

/** D10: the season's scoring weeks. */
export function useWeeks(leagueKey: string | null) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.weeks(leagueKey ?? ""),
      leagueKey !== null
        ? { dataset: { kind: "weeks" }, fetch: (signal) => getWeeks(leagueKey, signal) }
        : null
    )
  );
}
