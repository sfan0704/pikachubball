/**
 * Daily-stat values. Yahoo marks a missing value in several ways, and each
 * means something different on screen, so none of them is ever a 0.
 */

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

/** Made and attempted shots, kept as a pair so percentages come from sums. */
export interface MakesAttempts {
  readonly makes: number;
  readonly attempts: number;
}

/** A counting stat value (points, rebounds and so on). */
export type CountValue = StatValue<number>;

/** A shooting stat value (field goals or free throws). */
export type ShotValue = StatValue<MakesAttempts>;

/** One player's line for one date or period: the nine categories, with makes and attempts. */
export interface StatLine {
  readonly fg: ShotValue;
  readonly ft: ShotValue;
  readonly tpm: CountValue;
  readonly pts: CountValue;
  readonly reb: CountValue;
  readonly ast: CountValue;
  readonly stl: CountValue;
  readonly blk: CountValue;
  readonly to: CountValue;
}

/** The counting fields of a stat line. */
export const COUNT_FIELDS = ["tpm", "pts", "reb", "ast", "stl", "blk", "to"] as const;

/** One of the counting fields. */
export type CountField = (typeof COUNT_FIELDS)[number];

/** Wraps a reported value. */
export function measured<T>(value: T): Measured<T> {
  return { kind: "value", value };
}

/** A missing value of the given kind. */
export function missing(kind: MissingKind): MissingValue {
  return { kind };
}

/** A stat line whose every field is missing for the same reason, such as a day with no game. */
export function missingLine(kind: MissingKind): StatLine {
  const value = missing(kind);
  return {
    fg: value,
    ft: value,
    tpm: value,
    pts: value,
    reb: value,
    ast: value,
    stl: value,
    blk: value,
    to: value,
  };
}

/** How a player's date went, judged from the whole line. */
export type Appearance = "played" | MissingKind;

/**
 * "played" when any field was measured; otherwise the shared missing kind.
 * A line that mixes missing kinds can't be read safely, so it is "unavailable".
 */
export function appearance(line: StatLine): Appearance {
  const values = [line.fg, line.ft, ...COUNT_FIELDS.map((field) => line[field])];
  if (values.some((value) => value.kind === "value")) {
    return "played";
  }
  const first = values[0].kind as MissingKind;
  return values.every((value) => value.kind === first) ? first : "unavailable";
}
