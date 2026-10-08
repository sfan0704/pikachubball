import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@shared/api/account";
import type { LeagueScope } from "@shared/api/league-scope";
import { getLeagueScope, getLeagues, getMe, getRoster, savePreferences } from "./endpoints";
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

/** The team table for a league and scope; waits until both are chosen. */
export function useLeagueScope(leagueKey: string | null, scope: LeagueScope | null) {
  return useQuery({
    queryKey: queryKeys.leagueScope(leagueKey ?? "", scope ?? "season"),
    queryFn: ({ signal }) => getLeagueScope(leagueKey!, scope!, signal),
    enabled: leagueKey !== null && scope !== null,
  });
}

/** One team's roster; waits until the league and team are chosen. */
export function useRoster(leagueKey: string | null, teamKey: string | null) {
  return useQuery({
    queryKey: queryKeys.roster(leagueKey ?? "", teamKey ?? ""),
    queryFn: ({ signal }) => getRoster(leagueKey!, teamKey!, signal),
    enabled: leagueKey !== null && teamKey !== null,
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
