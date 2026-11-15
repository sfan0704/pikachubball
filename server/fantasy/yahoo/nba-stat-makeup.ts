import type { CategoryMakeup } from "../../../shared/domain";

/*
 * Yahoo's NBA stat list (recorded in tests/backend/fixtures/yahoo/stat-categories)
 * marks FG%, FT%, 3PT% and A/T as composite and names their two base stats,
 * but not which one is on top, so the four ratios are spelled out here.
 */
const RATIOS: Readonly<Record<string, Extract<CategoryMakeup, { kind: "ratio" }>>> = {
  "5": { kind: "ratio", topStatId: "4", bottomStatId: "3" },
  "8": { kind: "ratio", topStatId: "7", bottomStatId: "6" },
  "11": { kind: "ratio", topStatId: "10", bottomStatId: "9" },
  "20": { kind: "ratio", topStatId: "16", bottomStatId: "19" },
};

/*
 * Every other stat in Yahoo's NBA list that adds up across games. Minutes per
 * game (26) is an average, so it isn't here; ids Yahoo doesn't list aren't either.
 */
const COUNTING_STAT_IDS: ReadonlySet<string> = new Set([
  "0",
  "1",
  "2",
  "3",
  "4",
  "6",
  "7",
  "9",
  "10",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "21",
  "22",
  "23",
  "24",
  "25",
  "27",
  "28",
]);

/** How a Yahoo NBA stat is built from player stats; unavailable when the app can't tell. */
export function nbaStatMakeup(statId: string): CategoryMakeup {
  if (COUNTING_STAT_IDS.has(statId)) {
    return { kind: "counting" };
  }
  return RATIOS[statId] ?? { kind: "unavailable" };
}

/** Made and attempted shots (FGM/FGA, FTM/FTA, 3PTM/3PTA): makes can never exceed attempts. */
export const MAKES_ATTEMPTS: readonly (readonly [string, string])[] = [
  ["4", "3"],
  ["7", "6"],
  ["10", "9"],
];
