import type {
  CategoryComparison,
  CategoryResult,
  CategoryValues,
  LeagueCategory,
  TotalsComparison,
} from "@shared/domain";
import { categoryLabel, categoryRows } from "@/features/league/categories";
import { cn } from "@/lib/utils";
import { boardValueText } from "./matchup-board";

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
  /** The team's value in each category, by stat id. */
  readonly values: CategoryValues;
}

interface TotalsGridProps {
  mine: TotalsGridTeam;
  theirs: TotalsGridTeam;
  comparison: TotalsComparison;
  /** The selected category's stat id. */
  selected: string;
  onSelect: (statId: string) => void;
}

function TeamRow({
  team,
  side,
  categories,
  selected,
}: {
  team: TotalsGridTeam;
  side: "mine" | "theirs";
  categories: readonly LeagueCategory[];
  selected: string;
}) {
  return (
    <>
      <span
        className="truncate text-[11px] font-bold text-[#374151] dark:text-muted-foreground"
        title={team.label}
      >
        {team.label}
      </span>
      {categories.map((category) => (
        <span
          key={category.statId}
          data-testid={`grid-${side}-${category.statId}`}
          className={cn(
            "rounded-md py-1.5 text-center text-[11px] tabular-nums",
            category.statId === selected && "bg-[#FEF3C7] font-semibold dark:bg-amber-900/40"
          )}
        >
          {boardValueText(category, team.values[category.statId] ?? null)}
        </span>
      ))}
    </>
  );
}

function GridRow({ row, props }: { row: readonly CategoryComparison[]; props: TotalsGridProps }) {
  const { mine, theirs, selected, onSelect } = props;
  const categories = row.map((entry) => entry.category);
  return (
    <div
      className="grid items-center gap-x-0.5 gap-y-1"
      style={{ gridTemplateColumns: `44px repeat(${row.length}, minmax(0, 1fr))` }}
    >
      <span aria-hidden="true" />
      {row.map(({ category, result }) => (
        <button
          key={category.statId}
          type="button"
          aria-pressed={category.statId === selected}
          aria-label={`${categoryLabel(category)}, ${RESULT_NAME[result]}`}
          data-testid={`grid-category-${category.statId}`}
          data-result={result}
          onClick={() => onSelect(category.statId)}
          className={cn(
            "min-h-10 rounded-md text-[10.5px] font-extrabold",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            RESULT_TINT[result],
            category.statId === selected &&
              "shadow-[inset_0_0_0_2px_#15181D] dark:shadow-[inset_0_0_0_2px_white]"
          )}
        >
          {categoryLabel(category)}
        </button>
      ))}
      <TeamRow team={mine} side="mine" categories={categories} selected={selected} />
      <TeamRow team={theirs} side="theirs" categories={categories} selected={selected} />
    </div>
  );
}

/**
 * Both teams' totals in each of the league's categories. The headings are the
 * category picker: tinted by result, the selected one outlined. More than
 * nine categories split into rows of equal size so each stays readable.
 */
export function TotalsGrid(props: TotalsGridProps) {
  return (
    <div className="space-y-3" data-testid="totals-grid">
      {categoryRows(props.comparison.categories).map((row) => (
        <GridRow key={row[0].category.statId} row={row} props={props} />
      ))}
    </div>
  );
}
