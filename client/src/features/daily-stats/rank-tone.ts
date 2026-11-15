import type { RankTone } from "./league-board-model";

/** A category cell's background and text: green for the top three, red for the bottom three, else grey. */
export const TONE_CLASS: Readonly<Record<RankTone, string>> = {
  top: "bg-[#F0FDF4] text-[#15803D] dark:bg-green-950 dark:text-green-300",
  bottom: "bg-[#FEF2F2] text-[#B91C1C] dark:bg-red-950 dark:text-red-300",
  none: "bg-[#F9FAFB] text-foreground dark:bg-muted",
};

/** A rank badge in the standings: shaded green or red, plain in the middle. */
export const BADGE_TONE_CLASS: Readonly<Record<RankTone, string>> = {
  top: "bg-[#DCFCE7] text-[#15803D] dark:bg-green-950 dark:text-green-300",
  bottom: "bg-[#FEE2E2] text-[#B91C1C] dark:bg-red-950 dark:text-red-300",
  none: "",
};

/** A rank as text; unranked teams read as a dash, never as a place. */
export function rankText(rank: number | null): string {
  return rank === null ? "—" : String(rank);
}
