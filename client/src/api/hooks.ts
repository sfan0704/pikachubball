import { useQuery } from "@tanstack/react-query";
import type { LeagueScope } from "@shared/api/league-scope";
import { getLeagueScope, getLeagues, getMe, getRoster } from "./endpoints";
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
