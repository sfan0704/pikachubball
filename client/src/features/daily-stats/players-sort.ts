/**
 * Sorting the Players page. Yahoo pages its list in its own rank order, so
 * these sorts reorder the 25 players shown, like the page filters.
 */
import { perGameAverages, type LeagueCategory } from "@shared/domain";
import { categoryById, categoryLabel } from "@/features/league/categories";
import type { ListedPlayer, PlayerTotals } from "./players-model";

/** A sort on one category's average, by the category's stat id. */
export type CategorySort = `category-${string}`;

/** Yahoo's rank, rostered %, this week's add trend, or one category's average. */
export type PlayerSort = "rank" | "rostered" | "trend" | CategorySort;

const OTHER_SORTS = {
  rank: "Yahoo rank",
  rostered: "Rostered %",
  trend: "Add trend",
} as const;

/** The sort on a category. */
export function categorySort(category: LeagueCategory): CategorySort {
  return `category-${category.statId}`;
}

/** The sort choices in the order the menu lists them: Yahoo's, then the league's categories. */
export function playerSorts(categories: readonly LeagueCategory[]): PlayerSort[] {
  return [...(Object.keys(OTHER_SORTS) as PlayerSort[]), ...categories.map(categorySort)];
}

/** The category a sort is on, which the card then highlights; null for the other sorts. */
export function sortedCategory(
  sort: PlayerSort,
  categories: readonly LeagueCategory[]
): LeagueCategory | null {
  return sort.startsWith("category-")
    ? (categoryById(categories, sort.slice("category-".length)) ?? null)
    : null;
}

/** A sort choice as the menu names it. */
export function sortLabel(sort: PlayerSort, categories: readonly LeagueCategory[]): string {
  const category = sortedCategory(sort, categories);
  return category ? categoryLabel(category) : OTHER_SORTS[sort as keyof typeof OTHER_SORTS];
}

/** The value a row sorts on, oriented so higher is better; null sorts last. */
function sortValue(
  row: ListedPlayer,
  sort: Exclude<PlayerSort, "rank">,
  totals: ReadonlyMap<string, PlayerTotals>,
  categories: readonly LeagueCategory[]
): number | null {
  if (sort === "rostered") {
    // Yahoo leaves out anything under 1%, so a missing value is just below every listed one.
    return row.rostered.percent ?? 0;
  }
  if (sort === "trend") {
    return row.rostered.change;
  }
  const category = sortedCategory(sort, categories);
  const playerTotals = totals.get(row.player.playerKey);
  if (category === null || playerTotals === undefined) {
    return null;
  }
  const value = perGameAverages(playerTotals, [category])[category.statId] ?? null;
  if (value === null) {
    return null;
  }
  return category.direction === "lower" ? -value : value;
}

/** The rows in the chosen order; ties and Yahoo's rank keep Yahoo's order, and unknown averages go last. */
export function sortPlayers(
  rows: readonly ListedPlayer[],
  sort: PlayerSort,
  totals: ReadonlyMap<string, PlayerTotals>,
  categories: readonly LeagueCategory[]
): ListedPlayer[] {
  if (sort === "rank") {
    return [...rows];
  }
  const keyed = rows.map((row, index) => ({
    row,
    index,
    value: sortValue(row, sort, totals, categories),
  }));
  keyed.sort((a, b) => {
    if (a.value === b.value) {
      return a.index - b.index;
    }
    if (a.value === null) {
      return 1;
    }
    if (b.value === null) {
      return -1;
    }
    return b.value - a.value;
  });
  return keyed.map(({ row }) => row);
}
