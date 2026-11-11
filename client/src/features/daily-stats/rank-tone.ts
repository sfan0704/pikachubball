import type { RankTone } from "./league-board-model";

/** Text and background for a rank: green for the top three, red for the bottom three. */
export const TONE_CLASS: Readonly<Record<RankTone, string>> = {
  top: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
  bottom: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
  none: "bg-muted text-foreground",
};

/** A rank as text; unranked teams read as a dash, never as a place. */
export function rankText(rank: number | null): string {
  return rank === null ? "—" : String(rank);
}
