import { z } from "zod";
import type { GameLogsResponse } from "../../../shared/api/daily-stats";
import {
  missing,
  missingLine,
  type CountValue,
  type GameState,
  type LiveProgress,
  type StatLine,
} from "../../../shared/domain";
import { fragments, indexed, leagueSection, parseYahoo } from "../yahoo-shapes";
import { yahooDateLine, yahooMinutesValue } from "./stat-value-parsers";

/*
 * Yahoo's `out=game_log` lists each player's team games, past and about 8 days
 * ahead; a date without an entry has no game. The same block comes back from
 * the multi-key call (D3) and from the `status=T` pages (D6), so this parser
 * takes either body.
 */

/** One player's games as D3 sends them, with the player's minutes and line in each. */
export type GameLogPlayer = GameLogsResponse["players"][number];

type GameLogGame = GameLogPlayer["games"][number];

/** A game that has an entry: scheduled, live or final. "No game" is the absence of an entry. */
type PlayedGameState = Exclude<GameState, { kind: "noGame" }>;

/** Yahoo's minutes stat id. */
const MINUTES_STAT_ID = "2";

/** Unix seconds as Yahoo writes them, as ISO 8601 UTC. */
const unixSeconds = z.coerce
  .number()
  .int()
  .positive()
  .transform((seconds) => new Date(seconds * 1000).toISOString());

/** Yahoo writes `is_game_live` as the number 1 or 0; other flags elsewhere come as strings. */
const liveFlag = z.union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1")]);

const gameSchema = z.object({
  game_id: z.string().min(1),
  is_game_live: liveFlag.transform((flag) => Number(flag) === 1),
  /** Tip-off; the `status` text before tip-off is in the account's time zone, so it is never read. */
  start_time: unixSeconds,
  status: z.string(),
});

const gameLogEntrySchema = z.object({
  game_log_stats: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** The other team from this player's side: `@TOR` away at Toronto, `MIL` at home against Milwaukee. */
    opponent: z.string().regex(/^@?[A-Z]{2,4}$/),
    /** NBA teams play one game a date, so Yahoo lists exactly one. */
    games: z.array(z.object({ game: gameSchema })).length(1),
    stats: z.array(
      z.object({ stat: z.object({ stat_id: z.coerce.string(), value: z.unknown() }) })
    ),
  }),
});

type GameLogEntry = z.infer<typeof gameLogEntrySchema>["game_log_stats"];

/** Live text as `Q{n} {m:ss}, {own}-{opp}`; the score is from this player's team's side. */
const QUARTER_CLOCK = /^Q([1-4]) (\d{1,2}:\d{2}), (\d+)-(\d+)$/;
/** Final text as `W, {own}-{opp}` or `L, {own}-{opp}`. */
const FINAL_SCORE = /^([WL]), (\d+)-(\d+)$/;

/** Quarter, clock and score when Yahoo's live text reads as one; halftime, overtime and delays stay as written. */
function liveProgress(status: string): LiveProgress {
  const match = QUARTER_CLOCK.exec(status);
  if (match === null) {
    return { kind: "text", text: status };
  }
  const [, period, clock, own, opponent] = match;
  return {
    kind: "clock",
    period: Number(period),
    clock,
    ownScore: Number(own),
    opponentScore: Number(opponent),
  };
}

/**
 * The game's state. Yahoo's live flag decides live; a `W`/`L` score is final;
 * anything else is still to come, timed by `start_time`. A game Yahoo is slow
 * to flag counts as live from tip-off in the freshness policy, not here.
 */
function gameState(game: z.infer<typeof gameSchema>): PlayedGameState {
  if (game.is_game_live) {
    return { kind: "live", tipOff: game.start_time, progress: liveProgress(game.status) };
  }
  const final = FINAL_SCORE.exec(game.status);
  if (final === null) {
    return { kind: "scheduled", tipOff: game.start_time };
  }
  const [, result, own, opponent] = final;
  return {
    kind: "final",
    tipOff: game.start_time,
    result: result as "W" | "L",
    ownScore: Number(own),
    opponentScore: Number(opponent),
  };
}

/**
 * Minutes played. Positive minutes are measured. Otherwise the game's state
 * says what the gap means: before tip-off, and on the bench so far in a live
 * game, not yet played; after the final, did not play. Yahoo writes `-` for a
 * game that tipped off but isn't flagged live yet, which is not "no game".
 */
function minutesIn(entry: GameLogEntry, state: PlayedGameState): CountValue | null {
  const stat = entry.stats.find(({ stat }) => stat.stat_id === MINUTES_STAT_ID);
  const parsed = yahooMinutesValue.safeParse(stat?.stat.value);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.kind === "value" && parsed.data.value > 0) {
    return parsed.data;
  }
  return missing(state.kind === "final" ? "didNotPlay" : "notYetPlayed");
}

/**
 * The player's nine categories in the game. Without minutes the line has the
 * same gap as the minutes (not yet played, or did not play), whatever Yahoo
 * wrote in the other stats; with minutes, the stats are read as a date's line.
 */
function lineIn(entry: GameLogEntry, minutes: CountValue): StatLine | null {
  if (minutes.kind !== "value") {
    return missingLine(minutes.kind);
  }
  const parsed = yahooDateLine.safeParse(entry.stats);
  return parsed.success ? parsed.data : null;
}

const gameLogGameSchema = gameLogEntrySchema.transform(({ game_log_stats: entry }, context) => {
  const [{ game }] = entry.games;
  const state = gameState(game);
  const minutes = minutesIn(entry, state);
  const line = minutes === null ? null : lineIn(entry, minutes);
  if (minutes === null || line === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: minutes === null ? "unreadable minutes" : "unreadable stats",
      path: ["stats"],
    });
    return z.NEVER;
  }
  const away = entry.opponent.startsWith("@");
  const result: GameLogGame = {
    gameId: game.game_id,
    date: entry.date,
    opponent: away ? entry.opponent.slice(1) : entry.opponent,
    isHome: !away,
    state,
    minutes,
    line,
  };
  return result;
});

const gameLogPlayerSchema = z
  .object({
    player: z.tuple([
      fragments(
        z.object({
          player_key: z.string().regex(/^\d+\.p\.\d+$/),
          editorial_team_abbr: z.string().regex(/^[A-Z]{2,4}$/),
        })
      ),
      z.object({
        game_log: fragments(z.object({ game_log_stats_collection: z.array(gameLogGameSchema) })),
      }),
    ]),
  })
  .transform(({ player: [identity, log] }): GameLogPlayer => ({
    playerKey: identity.player_key,
    nbaTeam: identity.editorial_team_abbr,
    games: log.game_log.game_log_stats_collection,
  }));

const leaguePlayersSchema = z.object({
  fantasy_content: z.object({ league: z.array(z.unknown()) }),
});

/**
 * Each player's games from a `/league/{L}/players;…;out=game_log` body, in
 * Yahoo's order. A body that isn't shaped as recorded is YAHOO_UNAVAILABLE.
 */
export function parseGameLogPlayers(body: unknown): GameLogPlayer[] {
  const { league } = parseYahoo(leaguePlayersSchema, body).fantasy_content;
  return parseYahoo(indexed(gameLogPlayerSchema), leagueSection(league, "players"));
}
