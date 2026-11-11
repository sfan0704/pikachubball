import type { PlayerListQuery, StatPeriod } from "@shared/api/daily-stats";
import type { LeagueScope } from "@shared/api/league-scope";

const league = (leagueKey: string) => ["leagues", leagueKey] as const;
const team = (leagueKey: string, teamKey: string) =>
  [...league(leagueKey), "teams", teamKey] as const;

/** The same players in any order are the same request. */
const playerList = (players: readonly string[]) => [...players].sort().join(",");

/** One key per kind of server data, mirroring the API paths, so invalidating a prefix covers what hangs under it. */
export const queryKeys = {
  me: ["me"] as const,
  leagues: ["leagues"] as const,
  leagueScope: (leagueKey: string, scope: LeagueScope) =>
    [...league(leagueKey), "scope", String(scope)] as const,
  roster: (leagueKey: string, teamKey: string) => [...team(leagueKey, teamKey), "roster"] as const,
  teamDay: (leagueKey: string, teamKey: string, date: string) =>
    [...team(leagueKey, teamKey), "days", date] as const,
  gameLogs: (leagueKey: string, players: readonly string[]) =>
    [...league(leagueKey), "games", playerList(players)] as const,
  playerStats: (leagueKey: string, period: StatPeriod, players: readonly string[]) =>
    [...league(leagueKey), "player-stats", period, playerList(players)] as const,
  players: (leagueKey: string, query: PlayerListQuery) =>
    [
      ...league(leagueKey),
      "players",
      query.status,
      query.sort,
      query.position ?? "",
      query.search ?? "",
      query.start,
    ] as const,
  schedule: (leagueKey: string) => [...league(leagueKey), "schedule"] as const,
  transactions: (leagueKey: string, teamKey: string) =>
    [...team(leagueKey, teamKey), "transactions"] as const,
  draft: (leagueKey: string) => [...league(leagueKey), "draft"] as const,
  weeks: (leagueKey: string) => [...league(leagueKey), "weeks"] as const,
};
