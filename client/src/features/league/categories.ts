import { isPercentage, type LeagueCategory } from "@shared/domain";

export const UNAVAILABLE = "—";

/**
 * Yahoo's abbreviations that the screens have always shown differently, by
 * stat id; every other category shows Yahoo's own name.
 */
const SHOWN_NAMES: Readonly<Record<string, string>> = { "10": "3PM", "17": "STL" };

/** A category's heading, for example "PTS" or "3PT%". */
export function categoryLabel(category: LeagueCategory): string {
  return SHOWN_NAMES[category.statId] ?? category.displayName;
}

/** A league category by stat id. */
export function categoryById(
  categories: readonly LeagueCategory[],
  statId: string | null
): LeagueCategory | undefined {
  return categories.find((category) => category.statId === statId);
}

/** ".482": a percentage as box scores print it. */
export function boxScorePercent(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}

/**
 * A value as the cards print it: a percentage as ".482", another ratio (A/T)
 * to two places, a count as is.
 */
export function cardValueText(category: LeagueCategory, value: number): string {
  if (isPercentage(category)) {
    return boxScorePercent(value);
  }
  return category.makeup.kind === "ratio" ? value.toFixed(2) : String(value);
}

/** A per-game average: percentages as ".482", A/T to two places, counts to one. */
export function averageValueText(category: LeagueCategory, value: number): string {
  if (isPercentage(category)) {
    return boxScorePercent(value);
  }
  return value.toFixed(category.makeup.kind === "ratio" ? 2 : 1);
}

/** A team's total in one category as text; unknown values read as unavailable, never as zero. */
export function formatTotal(category: LeagueCategory, value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }
  if (isPercentage(category)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return category.makeup.kind === "ratio" ? value.toFixed(2) : String(value);
}

/** The most categories one row holds and stays readable at phone width. */
const MAX_PER_ROW = 9;

/** How many categories each row holds: all of them up to nine, else equal rows (12 as 6 and 6, not 9 and 3). */
export function categoriesPerRow(count: number): number {
  const rowCount = Math.max(1, Math.ceil(count / MAX_PER_ROW));
  return Math.max(1, Math.ceil(count / rowCount));
}

/** Items in rows of `categoriesPerRow` each. */
export function categoryRows<T>(items: readonly T[]): T[][] {
  const size = categoriesPerRow(items.length);
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    rows.push(items.slice(start, start + size));
  }
  return rows;
}
