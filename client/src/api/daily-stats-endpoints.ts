import {
  draftResponseSchema,
  gameLogsResponseSchema,
  playerListResponseSchema,
  playerStatsResponseSchema,
  scheduleResponseSchema,
  teamDayResponseSchema,
  transactionsResponseSchema,
  weeksResponseSchema,
  type PlayerListQuery,
  type StatPeriod,
} from "@shared/api/daily-stats";
import { apiRequest } from "./http";

const league = (leagueKey: string) => `/api/leagues/${encodeURIComponent(leagueKey)}`;
const team = (leagueKey: string, teamKey: string) =>
  `${league(leagueKey)}/teams/${encodeURIComponent(teamKey)}`;

/** `GET /api/leagues/:key/teams/:team/days/:date` */
export const getTeamDay = (
  leagueKey: string,
  teamKey: string,
  date: string,
  signal?: AbortSignal
) => apiRequest(`${team(leagueKey, teamKey)}/days/${date}`, teamDayResponseSchema, { signal });

/** `GET /api/leagues/:key/games?players=` */
export const getGameLogs = (leagueKey: string, players: readonly string[], signal?: AbortSignal) =>
  apiRequest(
    `${league(leagueKey)}/games?${new URLSearchParams({ players: players.join(",") })}`,
    gameLogsResponseSchema,
    { signal }
  );

/** `GET /api/leagues/:key/player-stats/:period?players=` */
export const getPlayerStats = (
  leagueKey: string,
  period: StatPeriod,
  players: readonly string[],
  signal?: AbortSignal
) =>
  apiRequest(
    `${league(leagueKey)}/player-stats/${period}?${new URLSearchParams({ players: players.join(",") })}`,
    playerStatsResponseSchema,
    { signal }
  );

function playerListParams(query: PlayerListQuery): URLSearchParams {
  const params = new URLSearchParams({
    status: query.status,
    sort: query.sort,
    start: String(query.start),
  });
  if (query.position !== undefined) {
    params.set("position", query.position);
  }
  if (query.search !== undefined) {
    params.set("search", query.search);
  }
  return params;
}

/** `GET /api/leagues/:key/players` */
export const listPlayers = (leagueKey: string, query: PlayerListQuery, signal?: AbortSignal) =>
  apiRequest(`${league(leagueKey)}/players?${playerListParams(query)}`, playerListResponseSchema, {
    signal,
  });

/** `GET /api/leagues/:key/schedule` */
export const getSchedule = (leagueKey: string, signal?: AbortSignal) =>
  apiRequest(`${league(leagueKey)}/schedule`, scheduleResponseSchema, { signal });

/** `GET /api/leagues/:key/teams/:team/transactions` */
export const getTransactions = (leagueKey: string, teamKey: string, signal?: AbortSignal) =>
  apiRequest(`${team(leagueKey, teamKey)}/transactions`, transactionsResponseSchema, { signal });

/** `GET /api/leagues/:key/draft` */
export const getDraft = (leagueKey: string, signal?: AbortSignal) =>
  apiRequest(`${league(leagueKey)}/draft`, draftResponseSchema, { signal });

/** `GET /api/leagues/:key/weeks` */
export const getWeeks = (leagueKey: string, signal?: AbortSignal) =>
  apiRequest(`${league(leagueKey)}/weeks`, weeksResponseSchema, { signal });
