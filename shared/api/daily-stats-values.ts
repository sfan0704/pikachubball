import { z } from "zod";
import type { GameState } from "../domain/game-state";
import type { MakesAttempts, MissingValue, StatLine, StatValue } from "../domain/stat-value";

/** A US Eastern date, YYYY-MM-DD, as Yahoo dates fantasy days. */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date");

/** A Yahoo league key, for example "478.l.14822". */
export const leagueKeySchema = z.string().regex(/^\d+\.l\.\d+$/, "must be a Yahoo league key");

/** A Yahoo team key, for example "478.l.14822.t.10". */
export const teamKeySchema = z.string().regex(/^\d+\.l\.\d+\.t\.\d+$/, "must be a Yahoo team key");

/** A Yahoo player key, for example "478.p.6014". */
export const playerKeySchema = z.string().regex(/^\d+\.p\.\d+$/, "must be a Yahoo player key");

/** An NBA team, by Yahoo's editorial abbreviation (for example "PHI"). */
export const nbaTeamSchema = z.string().regex(/^[A-Z]{2,4}$/, "must be an NBA team abbreviation");

const missingValueSchema = z.object({
  kind: z.enum(["noGame", "didNotPlay", "notYetPlayed", "unavailable"]),
}) satisfies z.ZodType<MissingValue>;

const countSchema = z.number().nonnegative();

const countValueSchema = z.union([
  z.object({ kind: z.literal("value"), value: countSchema }),
  missingValueSchema,
]) satisfies z.ZodType<StatValue<number>>;

const makesAttemptsSchema = z
  .object({ makes: countSchema, attempts: countSchema })
  .refine(
    ({ makes, attempts }) => makes <= attempts,
    "makes can't exceed attempts"
  ) satisfies z.ZodType<MakesAttempts>;

const shotValueSchema = z.union([
  z.object({ kind: z.literal("value"), value: makesAttemptsSchema }),
  missingValueSchema,
]) satisfies z.ZodType<StatValue<MakesAttempts>>;

/** A player's line for a date or period; each value is measured or tagged missing, never 0. */
export const statLineSchema = z.object({
  fg: shotValueSchema,
  ft: shotValueSchema,
  tpm: countValueSchema,
  pts: countValueSchema,
  reb: countValueSchema,
  ast: countValueSchema,
  stl: countValueSchema,
  blk: countValueSchema,
  to: countValueSchema,
}) satisfies z.ZodType<StatLine>;

/** Minutes played in one game, tagged like any stat value. */
export const minutesSchema = countValueSchema;

const timestampSchema = z.string().datetime();
const scoreSchema = z.number().int().nonnegative();

const liveProgressSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("clock"),
    period: z.number().int().positive(),
    clock: z.string().regex(/^\d{1,2}:\d{2}$/, "must be a game clock"),
    ownScore: scoreSchema,
    opponentScore: scoreSchema,
  }),
  z.object({ kind: z.literal("text"), text: z.string().min(1) }),
]);

const scheduledSchema = z.object({ kind: z.literal("scheduled"), tipOff: timestampSchema });
const liveSchema = z.object({
  kind: z.literal("live"),
  tipOff: timestampSchema,
  progress: liveProgressSchema,
});
const finalSchema = z.object({
  kind: z.literal("final"),
  tipOff: timestampSchema,
  result: z.enum(["W", "L"]),
  ownScore: scoreSchema,
  opponentScore: scoreSchema,
});

/** The state of a game that exists: scheduled, live or final. "No game" is the absence of a game. */
const gameStateSchema = z.discriminatedUnion("kind", [
  scheduledSchema,
  liveSchema,
  finalSchema,
]) satisfies z.ZodType<GameState>;

/** Who a player is. Injury fields are today's values and never describe a past date. */
export const dailyPlayerSchema = z.object({
  playerKey: playerKeySchema,
  name: z.string().min(1),
  nbaTeam: nbaTeamSchema,
  /** Eligible positions, for example ["PG", "SG"]. */
  positions: z.array(z.string().min(1)),
  /** Yahoo's designation today (GTD, Q, O, DTD, INJ, NA…) with its short reason, or null when healthy. */
  injuryToday: z
    .object({ designation: z.string().min(1), reason: z.string().min(1).nullable() })
    .nullable(),
});

export type DailyPlayer = z.infer<typeof dailyPlayerSchema>;

/** One NBA game of a team, from that team's side. */
export const nbaGameSchema = z.object({
  /** Yahoo's game id. */
  gameId: z.string().min(1),
  date: dateSchema,
  opponent: nbaTeamSchema,
  isHome: z.boolean(),
  state: gameStateSchema,
});

export type NbaGame = z.infer<typeof nbaGameSchema>;
