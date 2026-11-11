import { NotFoundError } from "../../shared/api/errors";
import type { PlayerListQuery, StatPeriod } from "../../shared/api/daily-stats";
import type {
  DailyStatsSource,
  Draft,
  GameLogs,
  PlayerPage,
  PlayerStats,
  Schedule,
  TeamDay,
  Transactions,
  Weeks,
} from "./daily-stats-source";
import type { DailyStatsRequests } from "./yahoo/daily-stats-requests";
import { parseDraft } from "./yahoo/draft-parser";
import { parseTransactions } from "./yahoo/transactions-parser";
import { checkDate, checkLeagueKey, checkPlayerKeys, checkTeamKey } from "./yahoo/daily-stats-keys";
import { parseTeamDay } from "./yahoo/team-day-parser";
import { parseWeeks } from "./yahoo/weeks-parser";

/** A dataset whose Yahoo resource isn't connected yet answers NOT_FOUND, like an unwired source. */
function notConnected(dataset: string): never {
  throw new NotFoundError(`Daily stats ${dataset}`);
}

/**
 * The daily-stats source that reads Yahoo live through one request's calls.
 * Every method checks its keys before any call. Each dataset is connected by
 * its own ticket (FAN-111 to FAN-118); until then it answers NOT_FOUND, and
 * production keeps its screens off through the feature list.
 */
export class YahooDailyStatsSource implements DailyStatsSource {
  constructor(private readonly requests: DailyStatsRequests) {}

  async getTeamDay(leagueKey: string, teamKey: string, date: string): Promise<TeamDay> {
    checkTeamKey(leagueKey, teamKey);
    checkDate(date);
    const body = await this.requests.get(
      "team day",
      `/team/${teamKey}/roster;date=${date}/players/stats;type=date;date=${date}`
    );
    return parseTeamDay(body, teamKey, date);
  }

  async getGameLogs(leagueKey: string, playerKeys: readonly string[]): Promise<GameLogs> {
    checkPlayerKeys(leagueKey, playerKeys);
    return notConnected("game logs");
  }

  async getPlayerStats(
    leagueKey: string,
    _period: StatPeriod,
    playerKeys: readonly string[]
  ): Promise<PlayerStats> {
    checkPlayerKeys(leagueKey, playerKeys);
    return notConnected("player totals");
  }

  async listPlayers(leagueKey: string, _query: PlayerListQuery): Promise<PlayerPage> {
    checkLeagueKey(leagueKey);
    return notConnected("player list");
  }

  async getSchedule(leagueKey: string): Promise<Schedule> {
    checkLeagueKey(leagueKey);
    return notConnected("schedule");
  }

  async getTransactions(leagueKey: string, teamKey: string): Promise<Transactions> {
    checkTeamKey(leagueKey, teamKey);
    const path = `/league/${leagueKey}/transactions;types=add,drop,trade;team_key=${teamKey}`;
    return parseTransactions(await this.requests.get("transactions", path), teamKey);
  }

  async getDraft(leagueKey: string): Promise<Draft> {
    checkLeagueKey(leagueKey);
    return parseDraft(await this.requests.get("draft", `/league/${leagueKey}/draftresults`));
  }

  async getWeeks(leagueKey: string): Promise<Weeks> {
    const gameKey = checkLeagueKey(leagueKey).split(".")[0];
    return parseWeeks(await this.requests.get("weeks", `/game/${gameKey}/game_weeks`), gameKey);
  }
}
