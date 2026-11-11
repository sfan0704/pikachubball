import { z } from "zod";
import {
  measured,
  missing,
  missingLine,
  type CountValue,
  type MakesAttempts,
  type ShotValue,
  type StatLine,
} from "../../../shared/domain";

/*
 * Yahoo writes every stat as text and marks a missing value in several ways.
 * Each way means something different on screen, so each becomes its own tagged
 * value; a shape not listed here fails validation instead of becoming a 0.
 */

const noGame = () => missing("noGame");
const notYetPlayed = () => missing("notYetPlayed");

const wholeNumber = z.union([
  z.number().int().nonnegative(),
  z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform((text) => Number(text)),
]);

/** A counting stat: `-` no game, `""` not yet played, otherwise a whole number. */
export const yahooCountValue = z.union([
  z.literal("-").transform(noGame),
  z.literal("").transform(notYetPlayed),
  wholeNumber.transform((value): CountValue => measured(value)),
]);

const makesAttempts = z
  .string()
  .regex(/^\d+\/\d+$/, "must be makes/attempts")
  .transform((text): MakesAttempts => {
    const [makes, attempts] = text.split("/").map(Number);
    return { makes, attempts };
  })
  .refine(({ makes, attempts }) => makes <= attempts, "makes can't exceed attempts");

/** Makes over attempts: `-` or `-/-` no game, `""` not yet played, otherwise `makes/attempts`. */
export const yahooShotValue = z.union([
  z.enum(["-", "-/-"]).transform(noGame),
  z.literal("").transform(notYetPlayed),
  makesAttempts.transform((value): ShotValue => measured(value)),
]);

const minutesAndSeconds = z
  .string()
  .regex(/^\d+:[0-5]\d$/, "must be mm:ss")
  .transform((text) => {
    const [minutes, seconds] = text.split(":").map(Number);
    return minutes + seconds / 60;
  });

/** Minutes played: a whole number in period stats, `mm:ss` in date stats and game logs. */
export const yahooMinutesValue = z.union([
  z.literal("-").transform(noGame),
  z.literal("").transform(notYetPlayed),
  z.union([wholeNumber, minutesAndSeconds]).transform((value): CountValue => measured(value)),
]);

/** Yahoo's stat id for each field of a stat line, and for games played. */
const STAT_IDS = {
  gamesPlayed: "0",
  fg: "9004003",
  ft: "9007006",
  tpm: "10",
  pts: "12",
  reb: "15",
  ast: "16",
  stl: "17",
  blk: "18",
  to: "19",
} as const;

/** Yahoo's `stats` list (`[{ stat: { stat_id, value } }]`) as values by stat id. */
const statsById = z
  .array(z.object({ stat: z.object({ stat_id: z.coerce.string(), value: z.unknown() }) }))
  .transform((stats) => Object.fromEntries(stats.map(({ stat }) => [stat.stat_id, stat.value])));

const dateValues = z.object({
  [STAT_IDS.gamesPlayed]: yahooCountValue.optional(),
  [STAT_IDS.fg]: yahooShotValue,
  [STAT_IDS.ft]: yahooShotValue,
  [STAT_IDS.tpm]: yahooCountValue,
  [STAT_IDS.pts]: yahooCountValue,
  [STAT_IDS.reb]: yahooCountValue,
  [STAT_IDS.ast]: yahooCountValue,
  [STAT_IDS.stl]: yahooCountValue,
  [STAT_IDS.blk]: yahooCountValue,
  [STAT_IDS.to]: yahooCountValue,
});

type DateValues = z.infer<typeof dateValues>;

const isZero = (value: CountValue) => value.kind === "value" && value.value === 0;
const isNoAttempts = (value: ShotValue) => value.kind === "value" && value.value.attempts === 0;

/**
 * Yahoo shows `-` on a date without a team game, so numbers mean the team
 * played. A player with GP 0, or with nothing but zeros and no shots on such a
 * date, sat it out: that is "did not play", not a line of zeros.
 */
function satOut(values: DateValues, line: StatLine): boolean {
  const gamesPlayed = values[STAT_IDS.gamesPlayed];
  if (gamesPlayed !== undefined && isZero(gamesPlayed)) {
    return true;
  }
  const counts = [line.tpm, line.pts, line.reb, line.ast, line.stl, line.blk, line.to];
  return isNoAttempts(line.fg) && isNoAttempts(line.ft) && counts.every(isZero);
}

function toLine(values: DateValues): StatLine {
  const line: StatLine = {
    fg: values[STAT_IDS.fg],
    ft: values[STAT_IDS.ft],
    tpm: values[STAT_IDS.tpm],
    pts: values[STAT_IDS.pts],
    reb: values[STAT_IDS.reb],
    ast: values[STAT_IDS.ast],
    stl: values[STAT_IDS.stl],
    blk: values[STAT_IDS.blk],
    to: values[STAT_IDS.to],
  };
  return satOut(values, line) ? missingLine("didNotPlay") : line;
}

/** One player's stats on one date (Yahoo's `stats` list) as a stat line; every category must be present. */
export const yahooDateLine = statsById.pipe(dateValues).transform(toLine);
