import { NotFoundError } from "../../../shared/api/errors";
import type { PlayerListQuery, StatPeriod } from "../../../shared/api/daily-stats";
import { addDays, nbaDateOf } from "../../../shared/domain";
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
} from "../daily-stats-source";
import {
  FIXTURE_NBA_TEAMS,
  LOG_DAYS_AHEAD,
  LOG_DAYS_BACK,
  fixtureGame,
  fixtureGames,
} from "./fixture-games";
import { lineOn, minutesIn, periodTotals } from "./fixture-lines";
import {
  ADDED_SLOT,
  FIXTURE_TEAM_COUNT,
  ROSTER_SIZE,
  allPlayers,
  droppedPlayer,
  rosterPlayer,
  slotOn,
  swapDate,
  type FixturePlayer,
} from "./fixture-players";
import { playerPage, scoringWeeks, snakeDraft, teamMoves } from "./fixture-league-data";

function gameOf(league: string): string {
  return league.slice(0, league.indexOf("."));
}

/** The team's number, or NOT_FOUND when the fixture league has no such team. */
function teamNumber(teamKey: string): number {
  const team = Number(teamKey.slice(teamKey.lastIndexOf(".") + 1));
  if (!Number.isInteger(team) || team < 1 || team > FIXTURE_TEAM_COUNT) {
    throw new NotFoundError("Team");
  }
  return team;
}

/**
 * A deterministic league-week for local development, CI and the review
 * environment, served in place of Yahoo until the Yahoo source is wired. It is
 * built only where the Yahoo stand-in is in use; production never gets it.
 * Dates follow the clock, so "today" always has a live, a final and a
 * not-started game, and the week around it is complete.
 */
export class FixtureDailyStatsSource implements DailyStatsSource {
  constructor(private readonly clock: { now(): number }) {}

  private today(): string {
    return nbaDateOf(this.clock.now());
  }

  /** Every listed player, or NOT_FOUND when the league has no such player. */
  private players(league: string, playerKeys: readonly string[]): FixturePlayer[] {
    const pool = new Map(allPlayers(gameOf(league)).map((p) => [p.player.playerKey, p]));
    return playerKeys.map((key) => {
      const player = pool.get(key);
      if (!player) {
        throw new NotFoundError("Player");
      }
      return player;
    });
  }

  async getTeamDay(leagueKey: string, teamKey: string, date: string): Promise<TeamDay> {
    const team = teamNumber(teamKey);
    const today = this.today();
    const swapped = date >= swapDate(today);
    const players = Array.from({ length: ROSTER_SIZE }, (_, index) => {
      const slot = index + 1;
      const player =
        slot === ADDED_SLOT && !swapped
          ? droppedPlayer(gameOf(leagueKey), team)
          : rosterPlayer(gameOf(leagueKey), team, slot);
      const game = fixtureGame(player.player.nbaTeam, date, today);
      return {
        player: player.player,
        ...slotOn(slot, date, today),
        line: lineOn(player, date, game, today),
      };
    });
    return { teamKey, date, players };
  }

  async getGameLogs(leagueKey: string, playerKeys: readonly string[]): Promise<GameLogs> {
    const today = this.today();
    const [from, to] = [addDays(today, -LOG_DAYS_BACK), addDays(today, LOG_DAYS_AHEAD)];
    return {
      players: this.players(leagueKey, playerKeys).map((player) => ({
        playerKey: player.player.playerKey,
        nbaTeam: player.player.nbaTeam,
        games: fixtureGames(player.player.nbaTeam, from, to, today).map((game) => ({
          ...game,
          minutes: minutesIn(player, game, today),
        })),
      })),
    };
  }

  async getPlayerStats(
    leagueKey: string,
    period: StatPeriod,
    playerKeys: readonly string[]
  ): Promise<PlayerStats> {
    return {
      period,
      players: this.players(leagueKey, playerKeys).map((player) => ({
        playerKey: player.player.playerKey,
        ...periodTotals(player, period),
      })),
    };
  }

  async listPlayers(leagueKey: string, query: PlayerListQuery): Promise<PlayerPage> {
    return playerPage(leagueKey, query, this.today());
  }

  async getSchedule(): Promise<Schedule> {
    const today = this.today();
    return {
      teams: FIXTURE_NBA_TEAMS.map((nbaTeam) => ({
        nbaTeam,
        games: fixtureGames(nbaTeam, addDays(today, -1), addDays(today, LOG_DAYS_AHEAD), today),
      })),
    };
  }

  async getTransactions(leagueKey: string, teamKey: string): Promise<Transactions> {
    return teamMoves(leagueKey, teamNumber(teamKey), this.today());
  }

  async getDraft(leagueKey: string): Promise<Draft> {
    return snakeDraft(leagueKey);
  }

  async getWeeks(): Promise<Weeks> {
    return scoringWeeks(this.today());
  }
}
