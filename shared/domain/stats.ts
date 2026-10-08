/**
 * Stats Domain Models
 * Statistical performance for teams and players
 */

/**
 * The 9 standard fantasy basketball categories
 */
export const CATEGORIES = [
  "fgPct",
  "ftPct",
  "tpm",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "to",
] as const;
export type CategoryKey = (typeof CATEGORIES)[number];
