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
import { parseGameLogPlayers } from "./yahoo/game-log-parser";
import { parsePlayerPage, playerListPath } from "./yahoo/player-list-parser";
import { readPlayerPeriodTotals } from "./yahoo/player-period-totals";
import { readSchedule } from "./yahoo/schedule-reader";
import { checkDate, checkLeagueKey, checkPlayerKeys, checkTeamKey } from "./yahoo/daily-stats-keys";
import { parseTeamDay } from "./yahoo/team-day-parser";
import { parseWeeks } from "./yahoo/weeks-parser";

/**
 * The daily-stats source that reads Yahoo live through one request's calls.
 * Every method checks its keys before any call. Production shows each screen
 * through the feature list once its datasets are connected (FAN-116, FAN-119).
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

  /** D3: one `out=game_log` call per 25 players; every listed player must come back. */
  async getGameLogs(leagueKey: string, playerKeys: readonly string[]): Promise<GameLogs> {
    const keys = checkPlayerKeys(leagueKey, playerKeys);
    const bodies = await this.requests.getForPlayers(
      "game logs",
      keys,
      (chunk) => `/league/${leagueKey}/players;player_keys=${chunk.join(",")};out=game_log`
    );
    const byKey = new Map(bodies.flatMap(parseGameLogPlayers).map((p) => [p.playerKey, p]));
    return {
      players: keys.map((key) => {
        const player = byKey.get(key);
        if (player === undefined) {
          throw new NotFoundError("Player game log");
        }
        return player;
      }),
    };
  }

  async getPlayerStats(
    leagueKey: string,
    period: StatPeriod,
    playerKeys: readonly string[]
  ): Promise<PlayerStats> {
    return readPlayerPeriodTotals(this.requests, period, checkPlayerKeys(leagueKey, playerKeys));
  }

  /** D5: one call per page of 25. */
  async listPlayers(leagueKey: string, query: PlayerListQuery): Promise<PlayerPage> {
    checkLeagueKey(leagueKey);
    const body = await this.requests.get("playerList", playerListPath(leagueKey, query));
    return parsePlayerPage(body, query.start);
  }

  /** D6: rostered players' game logs, page by page until every NBA team is covered. */
  async getSchedule(leagueKey: string): Promise<Schedule> {
    return readSchedule(this.requests, checkLeagueKey(leagueKey));
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
