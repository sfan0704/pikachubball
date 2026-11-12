import { useQueries, useQuery } from "@tanstack/react-query";
import type {
  PlayerListQuery,
  StatPeriod,
  TeamDayResponse,
  TeamDaysResponse,
} from "@shared/api/daily-stats";
import {
  getDraft,
  getGameLogs,
  getPlayerStats,
  getSchedule,
  getTeamDay,
  getTeamDays,
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
   * The dates that loaded, in date order, once none is still loading; dates
   * whose request failed are left out so the others still show under its
   * error. Undefined while any request loads, or when every request failed.
   */
  readonly data: TeamDayResponse[] | undefined;
  /** The first failure among the requests, if any. */
  readonly error: Error | null;
  /** When the oldest request's data landed, in epoch milliseconds. */
  readonly dataUpdatedAt: number;
  /** Retries the requests that failed. */
  readonly refetch: () => Promise<unknown>;
}

/** What the section reads from each of its requests, a range or a single date. */
interface DaysRequest {
  readonly data: readonly TeamDayResponse[] | undefined;
  readonly error: Error | null;
  readonly dataUpdatedAt: number;
  readonly refetch: () => Promise<unknown>;
}

function combineDays(requests: readonly DaysRequest[]): TeamDays {
  const failed = requests.filter((request) => request.error !== null);
  const loaded = requests.flatMap((request) => request.data ?? []);
  const settled = requests.filter(
    (request) => request.data !== undefined || request.error !== null
  ).length;
  return {
    data: loaded.length > 0 && settled === requests.length ? loaded : undefined,
    error: failed[0]?.error ?? null,
    dataUpdatedAt: Math.min(...requests.map((request) => request.dataUpdatedAt)),
    refetch: () => Promise.all(failed.map((request) => request.refetch())),
  };
}

/** A range's days as single-day bodies, each stamped with the range's fetch time. */
function asDays({ fetchedAt, days }: TeamDaysResponse): TeamDayResponse[] {
  return days.map((day) => ({ ...day, fetchedAt }));
}

/** The dates before today as one range request; idle when there are none. */
function useDayRange(leagueKey: string | null, teamKey: string | null, past: readonly string[]) {
  const from = past[0];
  const to = past[past.length - 1];
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.teamDays(leagueKey ?? "", teamKey ?? "", from ?? "", to ?? ""),
      leagueKey !== null && teamKey !== null && from !== undefined && to !== undefined
        ? {
            dataset: { kind: "teamDays", from, to },
            fetch: async (signal) =>
              asDays(await getTeamDays(leagueKey, teamKey, { from, to }, signal)),
          }
        : null
    )
  );
}

/**
 * D2 for each listed date of one team, as the Week view reads it. The dates
 * before today load as one range request; today (and any later date) loads on
 * its own, so it keeps its Live timers and shares the Today view's cache.
 * `dates` must run day by day with no gaps.
 */
export function useTeamDays(
  leagueKey: string | null,
  teamKey: string | null,
  dates: readonly string[],
  today: string
): TeamDays {
  const freshness = useFreshness();
  const past = dates.filter((date) => date < today);
  const range = useDayRange(leagueKey, teamKey, past);
  const singles = useQueries({
    queries: dates
      .filter((date) => date >= today)
      .map((date) =>
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
  });
  const requests: DaysRequest[] = singles.map((single) => ({
    data: single.data === undefined ? undefined : [single.data],
    error: single.error,
    dataUpdatedAt: single.dataUpdatedAt,
    refetch: single.refetch,
  }));
  return combineDays(past.length > 0 ? [range, ...requests] : requests);
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
