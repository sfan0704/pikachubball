import type {
  DraftResponse,
  GameLogsResponse,
  PlayerListQuery,
  PlayerListResponse,
  PlayerStatsResponse,
  ScheduleResponse,
  StatPeriod,
  TeamDayResponse,
  TransactionsResponse,
  WeeksResponse,
} from "../../shared/api/daily-stats";

/** A dataset as the source returns it; the service stamps the fetch time. */
type Dataset<T extends { fetchedAt: string }> = Omit<T, "fetchedAt">;

/** D2: one team's roster on a date, with each player's slot and line. */
export type TeamDay = Dataset<TeamDayResponse>;
/** D3: each listed player's team games, with the player's minutes. */
export type GameLogs = Dataset<GameLogsResponse>;
/** D4: each listed player's totals for a period. */
export type PlayerStats = Dataset<PlayerStatsResponse>;
/** D5: one page of the league's player pool. */
export type PlayerPage = Dataset<PlayerListResponse>;
/** D6: every NBA team's games from yesterday (US Eastern) to about 8 days ahead. */
export type Schedule = Dataset<ScheduleResponse>;
/** D7: one team's successful moves, newest first. */
export type Transactions = Dataset<TransactionsResponse>;
/** D8: the league's draft results. */
export type Draft = Dataset<DraftResponse>;
/** D10: the season's scoring weeks. */
export type Weeks = Dataset<WeeksResponse>;

/**
 * The only way the app reads daily stats: one method per dataset in the
 * retrieval plan, each returning validated domain data. Callers have already
 * checked the league is the user's and that every key belongs to it; a team or
 * player the league doesn't have is NOT_FOUND.
 */
export interface DailyStatsSource {
  getTeamDay(leagueKey: string, teamKey: string, date: string): Promise<TeamDay>;
  getGameLogs(leagueKey: string, playerKeys: readonly string[]): Promise<GameLogs>;
  getPlayerStats(
    leagueKey: string,
    period: StatPeriod,
    playerKeys: readonly string[]
  ): Promise<PlayerStats>;
  listPlayers(leagueKey: string, query: PlayerListQuery): Promise<PlayerPage>;
  getSchedule(leagueKey: string): Promise<Schedule>;
  getTransactions(leagueKey: string, teamKey: string): Promise<Transactions>;
  getDraft(leagueKey: string): Promise<Draft>;
  getWeeks(leagueKey: string): Promise<Weeks>;
}
