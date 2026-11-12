import {
  CATEGORIES,
  categoryValue,
  isShootingCategory,
  type CategoryKey,
  type CategoryResult,
  type TeamTotals,
  type TotalsComparison,
} from "@shared/domain";
import { CATEGORY_LABELS } from "@/features/league/categories";
import { cn } from "@/lib/utils";
import { percentText } from "./matchup-board";

/** The tint of a category's heading: green win, red loss, grey tie, none when unknown. */
const RESULT_TINT: Readonly<Record<CategoryResult, string>> = {
  win: "bg-[#DCFCE7] text-[#15181D] dark:bg-green-900/40 dark:text-green-100",
  loss: "bg-[#FEE2E2] text-[#15181D] dark:bg-red-900/40 dark:text-red-100",
  tie: "bg-[#F3F4F6] text-[#15181D] dark:bg-muted dark:text-foreground",
  unavailable: "text-[#15181D] dark:text-foreground",
};

const RESULT_NAME: Readonly<Record<CategoryResult, string>> = {
  win: "winning",
  loss: "losing",
  tie: "tied",
  unavailable: "no result yet",
};

/** One team's row of the grid. */
export interface TotalsGridTeam {
  readonly label: string;
  readonly totals: TeamTotals;
}

interface TotalsGridProps {
  mine: TotalsGridTeam;
  theirs: TotalsGridTeam;
  comparison: TotalsComparison;
  selected: CategoryKey;
  onSelect: (category: CategoryKey) => void;
}

/** A total as the grid shows it: percentages only, never makes/attempts; unknown is "–". */
function totalText(totals: TeamTotals, key: CategoryKey): string {
  const value = categoryValue(totals, key);
  if (value === null) {
    return "–";
  }
  return isShootingCategory(key) ? percentText(value) : String(value);
}

function TeamRow({
  team,
  side,
  selected,
}: {
  team: TotalsGridTeam;
  side: "mine" | "theirs";
  selected: CategoryKey;
}) {
  return (
    <>
      <span
        className="truncate text-[11px] font-bold text-[#374151] dark:text-muted-foreground"
        title={team.label}
      >
        {team.label}
      </span>
      {CATEGORIES.map((key) => (
        <span
          key={key}
          data-testid={`grid-${side}-${key}`}
          className={cn(
            "rounded-md py-1.5 text-center text-[11px] tabular-nums",
            key === selected && "bg-[#FEF3C7] font-semibold dark:bg-amber-900/40"
          )}
        >
          {totalText(team.totals, key)}
        </span>
      ))}
    </>
  );
}

/**
 * Both teams' week-to-date totals in the nine categories. The headings are the
 * category picker: tinted by result, the selected one outlined.
 */
export function TotalsGrid({ mine, theirs, comparison, selected, onSelect }: TotalsGridProps) {
  return (
    <div
      className="grid grid-cols-[44px_repeat(9,minmax(0,1fr))] items-center gap-x-0.5 gap-y-1"
      data-testid="totals-grid"
    >
      <span aria-hidden="true" />
      {comparison.categories.map(({ category, result }) => (
        <button
          key={category}
          type="button"
          aria-pressed={category === selected}
          aria-label={`${CATEGORY_LABELS[category]}, ${RESULT_NAME[result]}`}
          data-testid={`grid-category-${category}`}
          data-result={result}
          onClick={() => onSelect(category)}
          className={cn(
            "min-h-10 rounded-md text-[10.5px] font-extrabold",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            RESULT_TINT[result],
            category === selected &&
              "shadow-[inset_0_0_0_2px_#15181D] dark:shadow-[inset_0_0_0_2px_white]"
          )}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
      <TeamRow team={mine} side="mine" selected={selected} />
      <TeamRow team={theirs} side="theirs" selected={selected} />
    </div>
  );
}
