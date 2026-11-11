import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@shared/api/account";
import type { LeagueScope } from "@shared/api/league-scope";
import {
  deleteAccount,
  disconnectYahoo,
  getLeagueScope,
  getLeagues,
  getMe,
  getRoster,
  savePreferences,
} from "./endpoints";
import { freshQuery } from "./fresh-query";
import { useFreshness } from "./freshness";
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

/** D1, the team table for a league and scope; waits until both are chosen. */
export function useLeagueScope(leagueKey: string | null, scope: LeagueScope | null) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.leagueScope(leagueKey ?? "", scope ?? "season"),
      leagueKey !== null && scope !== null
        ? {
            dataset: { kind: "weekTable", scope: weekTableScope(scope) },
            fetch: (signal) => getLeagueScope(leagueKey, scope, signal),
          }
        : null
    )
  );
}

/** D9, one team's roster; waits until the league and team are chosen. */
export function useRoster(leagueKey: string | null, teamKey: string | null) {
  return useQuery(
    freshQuery(
      useFreshness(),
      queryKeys.roster(leagueKey ?? "", teamKey ?? ""),
      leagueKey !== null && teamKey !== null
        ? { dataset: { kind: "roster" }, fetch: (signal) => getRoster(leagueKey, teamKey, signal) }
        : null
    )
  );
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
