import { z } from "zod";
import {
  dailyPlayerSchema,
  dateSchema,
  leagueKeySchema,
  minutesSchema,
  nbaGameSchema,
  nbaTeamSchema,
  playerKeySchema,
  statLineSchema,
  teamKeySchema,
} from "./daily-stats-values";

/** When the server read the data from Yahoo (ISO 8601, UTC); every daily-stats response has it. */
const fetchedAtSchema = z.string().datetime();

/** The most player keys one request may name; the server splits them into Yahoo calls of 25. */
export const MAX_PLAYERS_PER_REQUEST = 50;

function gameOf(key: string): string {
  return key.slice(0, key.indexOf("."));
}

const teamInLeague = {
  check: ({ key, team }: { key: string; team: string }) => team.startsWith(`${key}.t.`),
  message: { message: "team is not in this league", path: ["team"] },
};

/** The path of `GET /api/leagues/:key/<dataset>`. */
export const leagueParamsSchema = z.object({ key: leagueKeySchema });

/** The path of `GET /api/leagues/:key/teams/:team/transactions`; the team must be in the league. */
export const teamParamsSchema = z
  .object({ key: leagueKeySchema, team: teamKeySchema })
  .refine(teamInLeague.check, teamInLeague.message);

/** The path of `GET /api/leagues/:key/teams/:team/days/:date`. */
export const teamDayParamsSchema = z
  .object({ key: leagueKeySchema, team: teamKeySchema, date: dateSchema })
  .refine(teamInLeague.check, teamInLeague.message);

/** Player keys as a comma-separated query value: distinct, at most 50. */
const playerKeysSchema = z
  .string()
  .transform((value) => value.split(","))
  .pipe(z.array(playerKeySchema).min(1).max(MAX_PLAYERS_PER_REQUEST))
  .refine((keys) => new Set(keys).size === keys.length, "player keys must not repeat");

/** The path and query of `GET /api/leagues/:key/games?players=`; players must be in the league's game. */
export const gameLogsRequestSchema = z
  .object({ key: leagueKeySchema, players: playerKeysSchema })
  .refine(({ key, players }) => players.every((player) => gameOf(player) === gameOf(key)), {
    message: "players must be from this league's season",
    path: ["players"],
  });

/** The stat periods a player's totals cover; last 7 and last 30 days end yesterday. */
export const statPeriodSchema = z.enum(["season", "last7", "last30"]);

export type StatPeriod = z.infer<typeof statPeriodSchema>;

/** The path and query of `GET /api/leagues/:key/player-stats/:period?players=`. */
export const playerStatsRequestSchema = z
  .object({ key: leagueKeySchema, period: statPeriodSchema, players: playerKeysSchema })
  .refine(({ key, players }) => players.every((player) => gameOf(player) === gameOf(key)), {
    message: "players must be from this league's season",
    path: ["players"],
  });

/** Yahoo lists 25 players a page. */
export const PLAYER_PAGE_SIZE = 25;

/** The query of `GET /api/leagues/:key/players`. */
export const playerListQuerySchema = z.object({
  status: z.enum(["available", "owned", "waivers"]),
  /** An eligible position or composite slot, for example "C" or "G". */
  position: z
    .string()
    .regex(/^[A-Za-z]{1,4}$/, "must be a position")
    .optional(),
  search: z.string().trim().min(1).max(40).optional(),
  /** Yahoo's actual rank (this season so far) or overall rank. */
  sort: z.enum(["actualRank", "overallRank"]),
  start: z.coerce
    .number()
    .int()
    .nonnegative()
    .refine((start) => start % PLAYER_PAGE_SIZE === 0, "must be a multiple of 25"),
});

export type PlayerListQuery = z.infer<typeof playerListQuerySchema>;

/** The body of `GET /api/leagues/:key/teams/:team/days/:date`: the roster that date and each player's line. */
export const teamDayResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  teamKey: teamKeySchema,
  date: dateSchema,
  players: z.array(
    z.object({
      player: dailyPlayerSchema,
      /** The roster slot that date, for example "PG", "Util", "BN" or "IL". */
      slot: z.string().min(1),
      /** Whether the slot counted for the team; bench and IL didn't. */
      isStartingSlot: z.boolean(),
      line: statLineSchema,
    })
  ),
});

export type TeamDayResponse = z.infer<typeof teamDayResponseSchema>;

/** The body of `GET /api/leagues/:key/games`: each player's team games, with the player's minutes and line in each. */
export const gameLogsResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  players: z.array(
    z.object({
      playerKey: playerKeySchema,
      nbaTeam: nbaTeamSchema,
      /** Every game of the player's team this season and about 8 days ahead; no entry means no game. */
      games: z.array(nbaGameSchema.extend({ minutes: minutesSchema, line: statLineSchema })),
    })
  ),
});

export type GameLogsResponse = z.infer<typeof gameLogsResponseSchema>;

/** The body of `GET /api/leagues/:key/player-stats/:period`: totals with games played. */
export const playerStatsResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  period: statPeriodSchema,
  players: z.array(
    z.object({
      playerKey: playerKeySchema,
      gamesPlayed: z.number().int().nonnegative(),
      line: statLineSchema,
    })
  ),
});

export type PlayerStatsResponse = z.infer<typeof playerStatsResponseSchema>;

const ownershipSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("team"), teamKey: teamKeySchema, teamName: z.string() }),
  z.object({ kind: z.literal("freeAgent") }),
  /** On waivers until the clear day Yahoo gives; the app never computes it. */
  z.object({ kind: z.literal("waivers"), clearsOn: dateSchema }),
]);

/** The body of `GET /api/leagues/:key/players`: one page of the league's player pool. */
export const playerListResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  start: z.number().int().nonnegative(),
  /** True when the page is full, so another may follow. */
  hasMore: z.boolean(),
  players: z
    .array(
      z.object({
        player: dailyPlayerSchema,
        ownership: ownershipSchema,
        /** Yahoo-wide rostered %, a weekly snapshot. */
        rostered: z.object({
          week: z.number().int().positive(),
          /** Null when Yahoo leaves it out, which it does for players under 1%; never 0. */
          percent: z.number().min(0).max(100).nullable(),
          /** Change in percentage points since the previous week. */
          change: z.number(),
        }),
      })
    )
    .max(PLAYER_PAGE_SIZE),
});

export type PlayerListResponse = z.infer<typeof playerListResponseSchema>;

/** The body of `GET /api/leagues/:key/schedule`: every NBA team's games from today to about 8 days ahead. */
export const scheduleResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  teams: z.array(z.object({ nbaTeam: nbaTeamSchema, games: z.array(nbaGameSchema) })),
});

export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

const placeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("freeAgents") }),
  z.object({ kind: z.literal("waivers") }),
  z.object({ kind: z.literal("team"), teamKey: teamKeySchema }),
]);

/** The body of `GET /api/leagues/:key/teams/:team/transactions`: the team's successful moves, newest first. */
export const transactionsResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  teamKey: teamKeySchema,
  transactions: z.array(
    z.object({
      transactionKey: z.string().min(1),
      kind: z.enum(["add", "drop", "addDrop", "trade"]),
      /** When Yahoo processed it (ISO 8601, UTC). */
      at: z.string().datetime(),
      /** The FAAB bid on a waiver claim, else null. */
      waiverBid: z.number().int().nonnegative().nullable(),
      players: z
        .array(
          z.object({
            playerKey: playerKeySchema,
            move: z.enum(["add", "drop", "trade"]),
            from: placeSchema,
            to: placeSchema,
          })
        )
        .min(1),
    })
  ),
});

export type TransactionsResponse = z.infer<typeof transactionsResponseSchema>;

/** The body of `GET /api/leagues/:key/draft`. */
export const draftResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  /** In an auction the round is only the nomination order, so screens show the cost instead. */
  isAuction: z.boolean(),
  picks: z.array(
    z.object({
      pick: z.number().int().positive(),
      round: z.number().int().positive(),
      teamKey: teamKeySchema,
      playerKey: playerKeySchema,
      /** The auction price; null in a snake draft. */
      cost: z.number().int().nonnegative().nullable(),
    })
  ),
});

export type DraftResponse = z.infer<typeof draftResponseSchema>;

/** The body of `GET /api/leagues/:key/weeks`: the season's scoring weeks, by Yahoo's boundaries. */
export const weeksResponseSchema = z.object({
  fetchedAt: fetchedAtSchema,
  weeks: z.array(
    z
      .object({ week: z.number().int().positive(), start: dateSchema, end: dateSchema })
      .refine(({ start, end }) => start <= end, "a week can't end before it starts")
  ),
});

export type WeeksResponse = z.infer<typeof weeksResponseSchema>;
