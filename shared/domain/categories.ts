/**
 * A league's scoring categories applied to player stats: which stats a
 * category is built from, and its value from summed stats. Counting
 * categories are their stat's sum; ratios are the summed top over the summed
 * bottom; a category the app can't build is unknown, never zero.
 */
import { percentage } from "./fantasy-rules";
import { statOf, type CountValue, type StatLine } from "./stat-value";
import type { LeagueCategory } from "./team-table";

/** A value per category, keyed by the category's stat id; null where it can't be known. */
export type CategoryValues = Readonly<Record<string, number | null>>;

/** Summed stats, keyed by Yahoo stat id; null once any counted value was unavailable. */
export type StatTotals = Readonly<Record<string, number | null>>;

/** The stats a category is built from: its own stat, a ratio's two, or none. */
export function categoryParts(category: LeagueCategory): string[] {
  switch (category.makeup.kind) {
    case "counting":
      return [category.statId];
    case "ratio":
      return [category.makeup.topStatId, category.makeup.bottomStatId];
    case "unavailable":
      return [];
  }
}

/** Every stat the categories are built from, each once. */
export function partsOfAll(categories: readonly LeagueCategory[]): string[] {
  return [...new Set(categories.flatMap(categoryParts))];
}

/** A category's value from summed stats; null when a part is unknown or a ratio's bottom is 0. */
export function categoryTotal(totals: StatTotals, category: LeagueCategory): number | null {
  const makeup = category.makeup;
  switch (makeup.kind) {
    case "counting":
      return totals[category.statId] ?? null;
    case "ratio":
      return percentage(totals[makeup.topStatId] ?? null, totals[makeup.bottomStatId] ?? null);
    case "unavailable":
      return null;
  }
}

/** Each category's value from summed stats. */
export function categoryTotals(
  totals: StatTotals,
  categories: readonly LeagueCategory[]
): CategoryValues {
  return Object.fromEntries(
    categories.map((category) => [category.statId, categoryTotal(totals, category)])
  );
}

/** Whether a category reads as a percentage (FG%, FT%, 3PT%): a ratio of makes over attempts. */
export function isPercentage(category: LeagueCategory): boolean {
  return category.makeup.kind === "ratio" && category.displayName.endsWith("%");
}

/** A ratio's two parts as measured, for example made and attempted field goals. */
export interface RatioParts {
  readonly top: number;
  readonly bottom: number;
}

/** A player's value in one category of one line. */
export type CategoryEntry =
  | {
      readonly kind: "value";
      /** The category's value: a count, or top over bottom (null when the bottom is 0). */
      readonly value: number | null;
      /** A ratio's two parts; null for counting categories. */
      readonly parts: RatioParts | null;
    }
  | { readonly kind: Exclude<CountValue["kind"], "value"> };

function ratioEntry(top: CountValue, bottom: CountValue): CategoryEntry {
  if (top.kind === "value" && bottom.kind === "value") {
    return {
      kind: "value",
      value: percentage(top.value, bottom.value),
      parts: { top: top.value, bottom: bottom.value },
    };
  }
  // Unknown on either side wins; otherwise both parts are missing for the line's reason.
  const missingKind = [top, bottom].find((part) => part.kind === "unavailable") ?? top;
  return { kind: missingKind.kind === "value" ? "unavailable" : missingKind.kind };
}

/** What a line says about one category: the measured value, or why there is none. */
export function categoryEntry(line: StatLine, category: LeagueCategory): CategoryEntry {
  const makeup = category.makeup;
  if (makeup.kind === "unavailable") {
    return { kind: "unavailable" };
  }
  if (makeup.kind === "ratio") {
    return ratioEntry(statOf(line, makeup.topStatId), statOf(line, makeup.bottomStatId));
  }
  const value = statOf(line, category.statId);
  return value.kind === "value"
    ? { kind: "value", value: value.value, parts: null }
    : { kind: value.kind };
}
