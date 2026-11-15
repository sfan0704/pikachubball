/**
 * Daily-stat values. Yahoo marks a missing value in several ways, and each
 * means something different on screen, so none of them is ever a 0.
 */
import type { GameState } from "./game-state";

/** Why a value is missing: no NBA game, a game the player sat out, a game still to come, or no data. */
export type MissingKind = "noGame" | "didNotPlay" | "notYetPlayed" | "unavailable";

/** A missing value, tagged with why it is missing. */
export interface MissingValue {
  readonly kind: MissingKind;
}

/** A value Yahoo reported. */
export interface Measured<T> {
  readonly kind: "value";
  readonly value: T;
}

/** A stat value: measured, or missing for a known reason. */
export type StatValue<T> = Measured<T> | MissingValue;

/** A counting stat value (points, rebounds, field goals made and so on). */
export type CountValue = StatValue<number>;

/**
 * One player's line for one date or period: each counting stat Yahoo sent, by
 * Yahoo stat id. Makes and attempts are separate stats (FGM "4" and FGA "3"),
 * so a percentage always comes from sums; ratios are never stored.
 */
export interface StatLine {
  readonly stats: Readonly<Record<string, CountValue>>;
  /**
   * What a stat the line doesn't list means: the whole line's missing kind
   * (no game, did not play, not yet played), or "unavailable" for a measured
   * line, since a stat Yahoo didn't send is unknown, not zero.
   */
  readonly otherwise: MissingKind;
}

/** Wraps a reported value. */
export function measured<T>(value: T): Measured<T> {
  return { kind: "value", value };
}

/** A missing value of the given kind. */
export function missing(kind: MissingKind): MissingValue {
  return { kind };
}

/** A stat line whose every stat is missing for the same reason, such as a day with no game. */
export function missingLine(kind: MissingKind): StatLine {
  return { stats: {}, otherwise: kind };
}

/** A line of the stats Yahoo sent; any other stat is unavailable. */
export function lineOf(stats: Readonly<Record<string, CountValue>>): StatLine {
  return { stats, otherwise: "unavailable" };
}

/** One stat of a line: its value, or why it is missing. */
export function statOf(line: StatLine, statId: string): CountValue {
  return line.stats[statId] ?? missing(line.otherwise);
}

/** How a player's date went, judged from the whole line. */
export type Appearance = "played" | MissingKind;

/**
 * "played" when any stat was measured; otherwise the shared missing kind.
 * A line that mixes missing kinds can't be read safely, so it is "unavailable".
 */
export function appearance(line: StatLine): Appearance {
  const values = Object.values(line.stats);
  if (values.some((value) => value.kind === "value")) {
    return "played";
  }
  if (values.length === 0) {
    return line.otherwise;
  }
  const first = values[0].kind as MissingKind;
  return values.every((value) => value.kind === first) ? first : "unavailable";
}

/**
 * A date line read together with the player's game that date. Yahoo's date
 * stats mark every stat `-` before tip-off, the same mark as a day with no
 * game, so a no-game line on a date whose game is scheduled or live is a game
 * still to come. With no game known (game logs loading or failed) the line is
 * kept as Yahoo sent it.
 */
export function lineWithGame(line: StatLine, game: GameState | null | undefined): StatLine {
  const gameAhead = game?.kind === "scheduled" || game?.kind === "live";
  return gameAhead && appearance(line) === "noGame" ? missingLine("notYetPlayed") : line;
}

/** Which missing kind a sum of missing values reads as: a sat-out game outranks one still to come. */
const MISSING_ORDER: readonly MissingKind[] = [
  "unavailable",
  "didNotPlay",
  "notYetPlayed",
  "noGame",
];

function combinedKind(kinds: ReadonlySet<MissingKind | "value">): MissingKind {
  return MISSING_ORDER.find((kind) => kinds.has(kind)) ?? "noGame";
}

function sumValues(values: readonly CountValue[]): CountValue {
  const kinds = new Set(values.map((value) => value.kind));
  if (kinds.has("unavailable")) {
    return missing("unavailable");
  }
  const measuredValues = values.flatMap((value) => (value.kind === "value" ? [value.value] : []));
  if (measuredValues.length > 0) {
    return measured(measuredValues.reduce((a, b) => a + b));
  }
  return missing(combinedKind(kinds));
}

/**
 * One player's lines added up, for example the games of a week. Each stat is
 * summed, so percentages come from the sums. An unavailable value makes that
 * stat unavailable; with nothing measured, the stat stays missing (no lines
 * at all is no game), never 0.
 */
export function sumLines(lines: readonly StatLine[]): StatLine {
  const statIds = new Set(lines.flatMap((line) => Object.keys(line.stats)));
  const stats = Object.fromEntries(
    [...statIds].map((statId) => [statId, sumValues(lines.map((line) => statOf(line, statId)))])
  );
  const anyMeasured = lines.some((line) => appearance(line) === "played");
  const otherwise = anyMeasured
    ? "unavailable"
    : combinedKind(new Set(lines.map((line) => line.otherwise)));
  return { stats, otherwise };
}
