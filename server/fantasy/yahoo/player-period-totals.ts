import { z } from "zod";
import { NotFoundError } from "../../../shared/api/errors";
import type { StatPeriod } from "../../../shared/api/daily-stats";
import { playerKeySchema } from "../../../shared/api/daily-stats-values";
import {
  lineOf,
  missing,
  missingLine,
  type CountValue,
  type StatLine,
} from "../../../shared/domain";
import type { PlayerStats } from "../daily-stats-source";
import { fragments, indexed, parseYahoo } from "../yahoo-shapes";
import type { DailyStatsRequests } from "./daily-stats-requests";
import { MAKES_ATTEMPTS } from "./nba-stat-makeup";
import { yahooCountValue, yahooPeriodStats } from "./stat-value-parsers";

/** Yahoo's name for each period; its last week and last month end yesterday (FAN-93). */
const YAHOO_PERIOD: Readonly<Record<StatPeriod, string>> = {
  season: "season",
  last7: "lastweek",
  last30: "lastmonth",
};

const gamesPlayedOf = (value: CountValue): number => (value.kind === "value" ? value.value : 0);

/**
 * A played period's totals: Yahoo writes `-` for a stat it doesn't total (games
 * started, for one), which is unknown here, never a missed game.
 */
function periodLine(stats: StatLine["stats"]): StatLine {
  return lineOf(
    Object.fromEntries(
      Object.entries(stats).map(([statId, value]) => [
        statId,
        value.kind === "value" ? value : missing("unavailable"),
      ])
    )
  );
}

/** Why a played period's totals can't be right: more makes than attempts. */
function totalsProblem(stats: StatLine["stats"]): string | null {
  const count = (statId: string) => {
    const value = stats[statId];
    return value?.kind === "value" ? value.value : null;
  };
  const tooMany = MAKES_ATTEMPTS.find(([makes, attempts]) => {
    const [made, tried] = [count(makes), count(attempts)];
    return made !== null && tried !== null && made > tried;
  });
  return tooMany ? "makes can't exceed attempts" : null;
}

/**
 * One player's period stats as games played and totals. The game-context call
 * (no /league prefix) sends every NBA stat, with makes and attempts as
 * separate stats. Yahoo writes GP 0 (or `-`) with zeros and `-` percentages
 * for a player who hasn't played in the period; that is "did not play", so the
 * screens show "—" rather than averages of zero.
 */
const periodTotals = yahooPeriodStats
  .pipe(z.object({ gamesPlayed: yahooCountValue, stats: z.custom<StatLine["stats"]>() }))
  .transform(({ gamesPlayed, stats }, context) => {
    const games = gamesPlayedOf(gamesPlayed);
    if (games === 0) {
      return { gamesPlayed: games, line: missingLine("didNotPlay") };
    }
    const problem = totalsProblem(stats);
    if (problem !== null) {
      context.addIssue({ code: "custom", message: problem });
      return z.NEVER;
    }
    return { gamesPlayed: games, line: periodLine(stats) };
  });

const playerStatsBody = z.object({
  fantasy_content: z.object({
    players: indexed(
      z.object({
        player: fragments(
          z.object({
            player_key: playerKeySchema,
            player_stats: z.object({ stats: periodTotals }),
          })
        ),
      })
    ),
  }),
});

function playerStatsPath(period: StatPeriod, playerKeys: readonly string[]): string {
  return `/players;player_keys=${playerKeys.join(",")}/stats;type=${YAHOO_PERIOD[period]}`;
}

/**
 * D4: each player's totals and games played for one period, one call per 25
 * players. Players come back in the order asked; a player Yahoo leaves out is
 * NOT_FOUND rather than a missing row.
 */
export async function readPlayerPeriodTotals(
  requests: DailyStatsRequests,
  period: StatPeriod,
  playerKeys: readonly string[]
): Promise<PlayerStats> {
  const bodies = await requests.getForPlayers("player totals", playerKeys, (chunk) =>
    playerStatsPath(period, chunk)
  );
  const byKey = new Map(
    bodies
      .flatMap((body) => parseYahoo(playerStatsBody, body).fantasy_content.players)
      .map(({ player }) => [player.player_key, player.player_stats.stats] as const)
  );
  const players = playerKeys.map((playerKey) => {
    const stats = byKey.get(playerKey);
    if (stats === undefined) {
      throw new NotFoundError("Player");
    }
    return { playerKey, ...stats };
  });
  return { period, players };
}
