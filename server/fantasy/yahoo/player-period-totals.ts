import { z } from "zod";
import { NotFoundError } from "../../../shared/api/errors";
import type { StatPeriod } from "../../../shared/api/daily-stats";
import { playerKeySchema } from "../../../shared/api/daily-stats-values";
import { measured, missingLine, type CountValue, type StatLine } from "../../../shared/domain";
import type { PlayerStats } from "../daily-stats-source";
import { fragments, indexed, parseYahoo } from "../yahoo-shapes";
import type { DailyStatsRequests } from "./daily-stats-requests";
import { yahooCountValue } from "./stat-value-parsers";

/** Yahoo's name for each period; its last week and last month end yesterday (FAN-93). */
const YAHOO_PERIOD: Readonly<Record<StatPeriod, string>> = {
  season: "season",
  last7: "lastweek",
  last30: "lastmonth",
};

/*
 * The game-context call (no /league prefix) sends makes and attempts as
 * separate stats (attempts first) rather than the league's combined
 * "made/attempted" stat.
 */
const STAT_IDS = {
  gamesPlayed: "0",
  fgAttempts: "3",
  fgMakes: "4",
  ftAttempts: "6",
  ftMakes: "7",
  tpm: "10",
  pts: "12",
  reb: "15",
  ast: "16",
  stl: "17",
  blk: "18",
  to: "19",
} as const;

const wholeNumber = z.union([
  z.number().int().nonnegative(),
  z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform((text) => Number(text)),
]);

const statsById = z
  .array(z.object({ stat: z.object({ stat_id: z.coerce.string(), value: z.unknown() }) }))
  .transform((stats) => Object.fromEntries(stats.map(({ stat }) => [stat.stat_id, stat.value])));

const totals = z
  .object({
    [STAT_IDS.fgMakes]: wholeNumber,
    [STAT_IDS.fgAttempts]: wholeNumber,
    [STAT_IDS.ftMakes]: wholeNumber,
    [STAT_IDS.ftAttempts]: wholeNumber,
    [STAT_IDS.tpm]: wholeNumber,
    [STAT_IDS.pts]: wholeNumber,
    [STAT_IDS.reb]: wholeNumber,
    [STAT_IDS.ast]: wholeNumber,
    [STAT_IDS.stl]: wholeNumber,
    [STAT_IDS.blk]: wholeNumber,
    [STAT_IDS.to]: wholeNumber,
  })
  .refine(
    (values) =>
      values[STAT_IDS.fgMakes] <= values[STAT_IDS.fgAttempts] &&
      values[STAT_IDS.ftMakes] <= values[STAT_IDS.ftAttempts],
    "makes can't exceed attempts"
  )
  .transform((values): StatLine => ({
    fg: measured({ makes: values[STAT_IDS.fgMakes], attempts: values[STAT_IDS.fgAttempts] }),
    ft: measured({ makes: values[STAT_IDS.ftMakes], attempts: values[STAT_IDS.ftAttempts] }),
    tpm: measured(values[STAT_IDS.tpm]),
    pts: measured(values[STAT_IDS.pts]),
    reb: measured(values[STAT_IDS.reb]),
    ast: measured(values[STAT_IDS.ast]),
    stl: measured(values[STAT_IDS.stl]),
    blk: measured(values[STAT_IDS.blk]),
    to: measured(values[STAT_IDS.to]),
  }));

const gamesPlayedOf = (value: CountValue): number => (value.kind === "value" ? value.value : 0);

/**
 * One player's period stats as games played and totals. Yahoo writes GP 0 (or
 * `-`) with zeros and `-` percentages for a player who hasn't played in the
 * period; that is "did not play", so the screens show "—" rather than averages
 * of zero.
 */
const periodTotals = statsById
  .pipe(z.object({ [STAT_IDS.gamesPlayed]: yahooCountValue }).passthrough())
  .transform((values, context) => {
    const gamesPlayed = gamesPlayedOf(values[STAT_IDS.gamesPlayed]);
    if (gamesPlayed === 0) {
      return { gamesPlayed, line: missingLine("didNotPlay") };
    }
    const line = totals.safeParse(values);
    if (!line.success) {
      line.error.issues.forEach((issue) => context.addIssue({ ...issue, code: "custom" }));
      return z.NEVER;
    }
    return { gamesPlayed, line: line.data };
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
