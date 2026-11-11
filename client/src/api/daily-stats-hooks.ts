import { skipToken, useQuery } from "@tanstack/react-query";
import type { PlayerListQuery, StatPeriod } from "@shared/api/daily-stats";
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
import { queryKeys } from "./query-keys";

/** D2: one team's roster and lines on a date; waits until all three are chosen. */
export function useTeamDay(leagueKey: string | null, teamKey: string | null, date: string | null) {
  return useQuery({
    queryKey: queryKeys.teamDay(leagueKey ?? "", teamKey ?? "", date ?? ""),
    queryFn:
      leagueKey !== null && teamKey !== null && date !== null
        ? ({ signal }) => getTeamDay(leagueKey, teamKey, date, signal)
        : skipToken,
  });
}

/** D3: game logs for the listed players; waits for at least one player. */
export function useGameLogs(leagueKey: string | null, players: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.gameLogs(leagueKey ?? "", players),
    queryFn:
      leagueKey !== null && players.length > 0
        ? ({ signal }) => getGameLogs(leagueKey, [...players].sort(), signal)
        : skipToken,
  });
}

/** D4: the listed players' totals for a period; waits for at least one player. */
export function usePlayerStats(
  leagueKey: string | null,
  period: StatPeriod,
  players: readonly string[]
) {
  return useQuery({
    queryKey: queryKeys.playerStats(leagueKey ?? "", period, players),
    queryFn:
      leagueKey !== null && players.length > 0
        ? ({ signal }) => getPlayerStats(leagueKey, period, [...players].sort(), signal)
        : skipToken,
  });
}

/** D5: one page of the league's player pool. */
export function usePlayerList(leagueKey: string | null, query: PlayerListQuery) {
  return useQuery({
    queryKey: queryKeys.players(leagueKey ?? "", query),
    queryFn: leagueKey !== null ? ({ signal }) => listPlayers(leagueKey, query, signal) : skipToken,
  });
}

/** D6: every NBA team's games from today on. */
export function useSchedule(leagueKey: string | null) {
  return useQuery({
    queryKey: queryKeys.schedule(leagueKey ?? ""),
    queryFn: leagueKey !== null ? ({ signal }) => getSchedule(leagueKey, signal) : skipToken,
  });
}

/** D7: one team's moves. */
export function useTransactions(leagueKey: string | null, teamKey: string | null) {
  return useQuery({
    queryKey: queryKeys.transactions(leagueKey ?? "", teamKey ?? ""),
    queryFn:
      leagueKey !== null && teamKey !== null
        ? ({ signal }) => getTransactions(leagueKey, teamKey, signal)
        : skipToken,
  });
}

/** D8: the league's draft results. */
export function useDraft(leagueKey: string | null) {
  return useQuery({
    queryKey: queryKeys.draft(leagueKey ?? ""),
    queryFn: leagueKey !== null ? ({ signal }) => getDraft(leagueKey, signal) : skipToken,
  });
}

/** D10: the season's scoring weeks. */
export function useWeeks(leagueKey: string | null) {
  return useQuery({
    queryKey: queryKeys.weeks(leagueKey ?? ""),
    queryFn: leagueKey !== null ? ({ signal }) => getWeeks(leagueKey, signal) : skipToken,
  });
}
