import { z } from "zod";
import {
  appearance,
  lineOf,
  measured,
  missing,
  missingLine,
  type CountValue,
  type StatLine,
  type StatValue,
} from "../../../shared/domain";
import { nbaStatMakeup } from "./nba-stat-makeup";

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

/** Made and attempted shots as Yahoo writes them together ("5/11"). */
interface MakesAttempts {
  readonly makes: number;
  readonly attempts: number;
}

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
  makesAttempts.transform((value): StatValue<MakesAttempts> => measured(value)),
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

/** Yahoo's stat ids for games played and minutes, which aren't scoring stats of a line. */
const GAMES_PLAYED_STAT_ID = "0";
const MINUTES_STAT_ID = "2";

/**
 * Yahoo's combined makes/attempts stats ("9004003" is FGM "4" over FGA "3"),
 * which the league context sends in place of the two counts.
 */
const COMBINED_STAT_ID = /^9(\d{3})(\d{3})$/;

/** Yahoo's `stats` list (`[{ stat: { stat_id, value } }]`) as values by stat id. */
const statsById = z
  .array(z.object({ stat: z.object({ stat_id: z.coerce.string(), value: z.unknown() }) }))
  .transform((stats) => Object.fromEntries(stats.map(({ stat }) => [stat.stat_id, stat.value])));

/** A combined value split into its two counts, both missing for the same reason when it is. */
function splitCombined(value: StatValue<MakesAttempts>): [CountValue, CountValue] {
  return value.kind === "value"
    ? [measured(value.value.makes), measured(value.value.attempts)]
    : [value, value];
}

type Issue = (message: string) => void;

/** How one stat of a line is read: counts and minutes as values, combined ones split in two. */
function readStat(statId: string, raw: unknown, fail: Issue) {
  const combined = COMBINED_STAT_ID.exec(statId);
  const schema = combined
    ? yahooShotValue
    : statId === MINUTES_STAT_ID
      ? yahooMinutesValue
      : yahooCountValue;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    fail(`stat ${statId} isn't readable`);
    return [];
  }
  if (combined) {
    const [top, bottom] = splitCombined(parsed.data as StatValue<MakesAttempts>);
    return [
      [String(Number(combined[1])), top],
      [String(Number(combined[2])), bottom],
    ] as const;
  }
  return [[statId, parsed.data as CountValue]] as const;
}

/**
 * Every counting stat in a Yahoo stats list, by stat id; ratios (built from
 * their parts), games played and stats the app doesn't know are left out.
 */
function countingStats(
  values: Readonly<Record<string, unknown>>,
  fail: Issue
): Record<string, CountValue> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(
        ([statId]) =>
          statId !== GAMES_PLAYED_STAT_ID &&
          (COMBINED_STAT_ID.test(statId) || nbaStatMakeup(statId).kind === "counting")
      )
      .flatMap(([statId, raw]) => readStat(statId, raw, fail))
  );
}

const isZero = (value: CountValue) => value.kind === "value" && value.value === 0;

/**
 * Yahoo shows `-` on a date without a team game, so numbers mean the team
 * played. A player with GP 0, or with nothing but zeros (minutes aside) on
 * such a date, sat it out: that is "did not play", not a line of zeros.
 */
function satOut(gamesPlayed: unknown, stats: Readonly<Record<string, CountValue>>): boolean {
  if (gamesPlayed !== undefined) {
    const parsed = yahooCountValue.safeParse(gamesPlayed);
    if (parsed.success && isZero(parsed.data)) {
      return true;
    }
  }
  const scoring = Object.entries(stats).filter(([statId]) => statId !== MINUTES_STAT_ID);
  return scoring.length > 0 && scoring.every(([, value]) => isZero(value));
}

/**
 * One player's stats on one date (Yahoo's `stats` list) as a stat line of
 * every counting stat sent. A date whose every stat is missing for one reason
 * (`-` no game, `""` not yet played) is that reason for the whole line, so a
 * stat the league doesn't send reads the same way.
 */
export const yahooDateLine = statsById.transform((values, context): StatLine => {
  const fail: Issue = (message) => context.addIssue({ code: "custom", message });
  const stats = countingStats(values, fail);
  if (satOut(values[GAMES_PLAYED_STAT_ID], stats)) {
    return missingLine("didNotPlay");
  }
  const line = lineOf(stats);
  const kind = appearance(line);
  return kind === "noGame" || kind === "notYetPlayed" ? missingLine(kind) : line;
});

/**
 * A period's totals (Yahoo's `stats` list for a season, last week or last
 * month) as games played, still as Yahoo wrote it, and every counting stat.
 */
export const yahooPeriodStats = statsById.transform((values, context) => {
  const fail: Issue = (message) => context.addIssue({ code: "custom", message });
  return {
    gamesPlayed: values[GAMES_PLAYED_STAT_ID],
    stats: countingStats(values, fail),
  };
});
