import type { CategoryKey } from "@shared/domain";

/** Column headings for the nine categories. */
export const CATEGORY_LABELS: Readonly<Record<CategoryKey, string>> = {
  fgPct: "FG%",
  ftPct: "FT%",
  tpm: "3PM",
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  to: "TO",
};

export const UNAVAILABLE = "—";
