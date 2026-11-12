import type { RankTone } from "./league-board-model";

/** A category cell's background and text: green for the top three, red for the bottom three, else grey. */
export const TONE_CLASS: Readonly<Record<RankTone, string>> = {
  top: "bg-[#F0FDF4] text-[#15803D] dark:bg-green-950 dark:text-green-300",
  bottom: "bg-[#FEF2F2] text-[#B91C1C] dark:bg-red-950 dark:text-red-300",
  none: "bg-[#F9FAFB] text-foreground dark:bg-muted",
};

/** A League tile's border and background, by the user's rank. */
export const TILE_TONE_CLASS: Readonly<Record<RankTone, string>> = {
  top: "border-[#BBF7D0] bg-[#F0FDF4] dark:border-green-900 dark:bg-green-950",
  bottom: "border-[#FECACA] bg-[#FEF2F2] dark:border-red-900 dark:bg-red-950",
  none: "border-[#E2E5EA] bg-[#F9FAFB] dark:border-border dark:bg-muted",
};

/** The rank's colour on a tile or in a cell; a middling rank keeps the text colour. */
export const RANK_TEXT_CLASS: Readonly<Record<RankTone, string>> = {
  top: "text-[#15803D] dark:text-green-300",
  bottom: "text-[#B91C1C] dark:text-red-300",
  none: "",
};

/** The rank badge at the start of a list row: shaded green or red, plain in the middle. */
export const BADGE_TONE_CLASS: Readonly<Record<RankTone, string>> = {
  top: "bg-[#DCFCE7] text-[#15803D] dark:bg-green-950 dark:text-green-300",
  bottom: "bg-[#FEE2E2] text-[#B91C1C] dark:bg-red-950 dark:text-red-300",
  none: "",
};

/** A rank as text; unranked teams read as a dash, never as a place. */
export function rankText(rank: number | null): string {
  return rank === null ? "—" : String(rank);
}
