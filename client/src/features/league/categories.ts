import { categoryValue, type CategoryKey, type TeamTotals } from "@shared/domain";

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

function percent(fraction: number | null): string {
  return fraction === null ? UNAVAILABLE : `${(fraction * 100).toFixed(1)}%`;
}

/** A team's total in one category as text; unknown values read as unavailable, never as zero. */
export function formatTotal(totals: TeamTotals, key: CategoryKey, withMakes = false): string {
  if (key === "fgPct" || key === "ftPct") {
    const makes = key === "fgPct" ? totals.fgMakes : totals.ftMakes;
    const attempts = key === "fgPct" ? totals.fgAttempts : totals.ftAttempts;
    const text = percent(categoryValue(totals, key));
    return withMakes && makes !== null && attempts !== null
      ? `${makes}/${attempts} (${text})`
      : text;
  }
  const value = totals[key];
  return value === null ? UNAVAILABLE : String(value);
}
