/**
 * Sorting the Players page. Yahoo pages its list in its own rank order, so
 * these sorts reorder the 25 players shown, like the page filters.
 */
import { perGameAverages, type CategoryKey } from "@shared/domain";
import { CATEGORY_LABELS } from "@/features/league/categories";
import type { ListedPlayer, PlayerTotals } from "./players-model";

/** Yahoo's rank, rostered %, this week's add trend, or one category's average. */
export type PlayerSort = "rank" | "rostered" | "trend" | CategoryKey;

/** The sort choices in the order the menu lists them. */
export const PLAYER_SORTS: readonly PlayerSort[] = [
  "rank",
  "rostered",
  "trend",
  "pts",
  "reb",
  "ast",
  "tpm",
  "stl",
  "blk",
  "fgPct",
  "ftPct",
  "to",
];

/** The sort choices as the menu names them. */
export const SORT_LABELS: Readonly<Record<PlayerSort, string>> = {
  rank: "Yahoo rank",
  rostered: "Rostered %",
  trend: "Add trend",
  ...CATEGORY_LABELS,
};

/** Whether a sort is one of the nine categories, which the card then highlights. */
export function isCategorySort(sort: PlayerSort): sort is CategoryKey {
  return sort !== "rank" && sort !== "rostered" && sort !== "trend";
}

/** The value a row sorts on, oriented so higher is better; null sorts last. */
function sortValue(
  row: ListedPlayer,
  sort: Exclude<PlayerSort, "rank">,
  totals: ReadonlyMap<string, PlayerTotals>
): number | null {
  if (sort === "rostered") {
    // Yahoo leaves out anything under 1%, so a missing value is just below every listed one.
    return row.rostered.percent ?? 0;
  }
  if (sort === "trend") {
    return row.rostered.change;
  }
  const playerTotals = totals.get(row.player.playerKey);
  const value = playerTotals === undefined ? null : perGameAverages(playerTotals)[sort];
  if (value === null) {
    return null;
  }
  return sort === "to" ? -value : value;
}

/** The rows in the chosen order; ties and Yahoo's rank keep Yahoo's order, and unknown averages go last. */
export function sortPlayers(
  rows: readonly ListedPlayer[],
  sort: PlayerSort,
  totals: ReadonlyMap<string, PlayerTotals>
): ListedPlayer[] {
  if (sort === "rank") {
    return [...rows];
  }
  const keyed = rows.map((row, index) => ({ row, index, value: sortValue(row, sort, totals) }));
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
