import { ForbiddenError } from "../../shared/api/errors";
import type { PlayerListQuery, StatPeriod } from "../../shared/api/daily-stats";
import type { DailyStatsSource } from "../fantasy/daily-stats-source";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";
import type { Clock } from "../utils/clock";

/** What every daily-stats use case needs: the user's leagues, the source and the clock. */
export interface DailyStatsAccess {
  readonly storage: Pick<OwnerScopedStorage, "ownsLeague">;
  readonly source: DailyStatsSource;
  readonly clock: Clock;
}

/** Reads one dataset for a league the user has, stamped with when it was read. */
async function readInLeague<T extends object>(
  { storage, source, clock }: DailyStatsAccess,
  leagueKey: string,
  read: (source: DailyStatsSource) => Promise<T>
): Promise<T & { fetchedAt: string }> {
  if (!(await storage.ownsLeague(leagueKey))) {
    throw new ForbiddenError("League not available to this account");
  }
  const data = await read(source);
  return { ...data, fetchedAt: new Date(clock.now()).toISOString() };
}

/** D2: one team's roster and lines on a date. */
export function getTeamDay(access: DailyStatsAccess, key: string, team: string, date: string) {
  return readInLeague(access, key, (source) => source.getTeamDay(key, team, date));
}

/** D3: the listed players' game logs. */
export function getGameLogs(access: DailyStatsAccess, key: string, players: readonly string[]) {
  return readInLeague(access, key, (source) => source.getGameLogs(key, players));
}

/** D4: the listed players' totals for a period. */
export function getPlayerStats(
  access: DailyStatsAccess,
  key: string,
  period: StatPeriod,
  players: readonly string[]
) {
  return readInLeague(access, key, (source) => source.getPlayerStats(key, period, players));
}

/** D5: one page of the league's player pool. */
export function listPlayers(access: DailyStatsAccess, key: string, query: PlayerListQuery) {
  return readInLeague(access, key, (source) => source.listPlayers(key, query));
}

/** D6: every NBA team's games from yesterday (US Eastern) on. */
export function getSchedule(access: DailyStatsAccess, key: string) {
  return readInLeague(access, key, (source) => source.getSchedule(key));
}

/** D7: one team's moves. */
export function getTransactions(access: DailyStatsAccess, key: string, team: string) {
  return readInLeague(access, key, (source) => source.getTransactions(key, team));
}

/** D8: the league's draft results. */
export function getDraft(access: DailyStatsAccess, key: string) {
  return readInLeague(access, key, (source) => source.getDraft(key));
}

/** D10: the season's scoring weeks. */
export function getWeeks(access: DailyStatsAccess, key: string) {
  return readInLeague(access, key, (source) => source.getWeeks(key));
}
