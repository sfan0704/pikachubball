import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@shared/api/account";
import type { LeagueScope } from "@shared/api/league-scope";
import { seasonWeekScopes, type SeasonWeeks, type TeamTable } from "@shared/domain";
import {
  deleteAccount,
  disconnectYahoo,
  getLeagueScope,
  getLeagues,
  getMe,
  savePreferences,
} from "./endpoints";
import { freshQuery } from "./fresh-query";
import { useFreshness, type Freshness } from "./freshness";
import { queryKeys } from "./query-keys";

/** The signed-in user, their Yahoo connection and saved choices. */
export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => getMe(signal) });
}

/** The user's stored leagues. */
export function useLeagues() {
  return useQuery({
    queryKey: queryKeys.leagues,
    queryFn: ({ signal }) => getLeagues(false, signal),
  });
}

/** D1's class follows the scope: earlier weeks no longer change. */
function weekTableScope(scope: LeagueScope): "season" | "current" | "past" {
  return typeof scope === "number" ? "past" : scope;
}

/** D1's query for a league and scope, with the class its scope takes; idle until both are chosen. */
function leagueScopeQuery(
  freshness: Freshness,
  leagueKey: string | null,
  scope: LeagueScope | null
) {
  return freshQuery(
    freshness,
    queryKeys.leagueScope(leagueKey ?? "", scope ?? "season"),
    leagueKey !== null && scope !== null
      ? {
          dataset: { kind: "weekTable", scope: weekTableScope(scope) },
          fetch: (signal) => getLeagueScope(leagueKey, scope, signal),
        }
      : null
  );
}

/** D1, the team table for a league and scope; waits until both are chosen. */
export function useLeagueScope(leagueKey: string | null, scope: LeagueScope | null) {
  return useQuery(leagueScopeQuery(useFreshness(), leagueKey, scope));
}

/** Every week's table of the season so far, read together for Season all-play. */
export interface SeasonWeekTables {
  /**
   * Each week's table in week order, the week in progress last as it stands.
   * Undefined while any week loads or when any week failed: all-play over
   * some of the weeks would be a wrong number, not a partial one.
   */
  readonly data: TeamTable[] | undefined;
  /** The first failure among the weeks, if any. */
  readonly error: Error | null;
  /** When the oldest week's data landed, in epoch milliseconds. */
  readonly dataUpdatedAt: number;
  /** Retries the weeks that failed. */
  readonly refetch: () => Promise<unknown>;
}

/**
 * D1 for every week of the season so far, which Season totals needs for
 * all-play and luck. Each week is its own request through the week endpoint,
 * cached with the week picker's tables, so a visit asks for each week once.
 * Waits until the league and its season weeks are known.
 */
export function useSeasonWeekTables(
  leagueKey: string | null,
  weeks: SeasonWeeks | null
): SeasonWeekTables {
  const freshness = useFreshness();
  const scopes = leagueKey !== null && weeks !== null ? seasonWeekScopes(weeks) : [];
  return useQueries({
    queries: scopes.map((scope) => leagueScopeQuery(freshness, leagueKey, scope)),
    combine: (results) => {
      const failed = results.filter((result) => result.error !== null);
      const tables = results.flatMap((result) => (result.data === undefined ? [] : [result.data]));
      const ready = results.length > 0 && tables.length === results.length;
      return {
        data: ready ? tables : undefined,
        error: failed[0]?.error ?? null,
        dataUpdatedAt: ready ? Math.min(...results.map((result) => result.dataUpdatedAt)) : 0,
        refetch: () => Promise.all(failed.map((result) => result.refetch())),
      };
    },
  });
}

/**
 * Retries every league table on screen whose last fetch failed: the period's
 * table and the season weeks behind all-play, so one "Try again" clears both.
 * Tables that loaded are not fetched again.
 */
export function useRetryFailedLeagueTables(leagueKey: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.refetchQueries({
      queryKey: queryKeys.leagueScopes(leagueKey),
      type: "active",
      predicate: (query) => query.state.status === "error",
    });
}

/** Saves the user's choices and keeps the cached user in step with what is stored. */
export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData<MeResponse>(queryKeys.me, (me) =>
        me ? { ...me, preferences } : me
      );
    },
  });
}

/** Disconnects Yahoo, then drops everything cached from it so no screen keeps showing old leagues. */
export function useDisconnectYahoo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectYahoo,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.leagues });
      return queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

/** Deletes the account and clears the whole cache. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => queryClient.clear(),
  });
}

/** Replaces the stored league list with Yahoo's current one and shows the result at once. */
export function useRefreshLeagues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getLeagues(true),
    onSuccess: (leagues) => queryClient.setQueryData(queryKeys.leagues, leagues),
  });
}
