import type { LeagueScope } from "@shared/api/league-scope";

/** One key per kind of server data, mirroring the API paths, so invalidating a prefix covers what hangs under it. */
export const queryKeys = {
  me: ["me"] as const,
  leagues: ["leagues"] as const,
  leagueScope: (leagueKey: string, scope: LeagueScope) =>
    ["leagues", leagueKey, "scope", String(scope)] as const,
  roster: (leagueKey: string, teamKey: string) =>
    ["leagues", leagueKey, "teams", teamKey, "roster"] as const,
};
