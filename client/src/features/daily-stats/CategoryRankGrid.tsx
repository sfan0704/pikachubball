import { useMemo, useRef, type MouseEvent, type Ref } from "react";
import type { TeamTable } from "@shared/domain";
import { categoryLabel } from "@/features/league/categories";
import { cn } from "@/lib/utils";
import {
  categoryGrid,
  type CategoryGrid,
  type GridCell,
  type GridRow,
} from "./league-categories-model";
import { CARD_HEADING_CLASS, PICKED_ROW_CLASS, pickedState, useKeepInView } from "./league-wide";
import { rankText, TONE_CLASS } from "./rank-tone";

interface CategoryRankGridProps {
  table: TeamTable;
  myTeamKey: string;
  /** The stat id of the picked category, or null. */
  category: string | null;
  /** The team outlined as picked on a wide screen; null on a phone. */
  pickedTeamKey: string | null;
  /** The card's heading where no Standings | Categories bar names it; null on a phone. */
  heading: string | null;
  onPick: (category: string | null) => void;
  onOpenTeam: (teamKey: string, event: MouseEvent<HTMLButtonElement>) => void;
}

// The team column stays put while the ranks scroll sideways, so it needs its own background.
const STICKY = "sticky left-0 z-10 bg-white dark:bg-card";
const MINE_STICKY = "bg-[#FFFBEB] dark:bg-[#2A2210]";

function Cell({ cell }: { cell: GridCell }) {
  return (
    <td className="px-px py-1">
      <span
        className={cn(
          "block rounded-[6px] py-[5px] text-center text-xs font-bold",
          TONE_CLASS[cell.tone],
          cell.picked && "shadow-[inset_0_0_0_2px_#15181D] dark:shadow-[inset_0_0_0_2px_white]"
        )}
      >
        {rankText(cell.rank)}
      </span>
    </td>
  );
}

function Row({
  row,
  picked,
  rowRef,
  onOpen,
}: {
  row: GridRow;
  picked: boolean | undefined;
  rowRef: Ref<HTMLTableRowElement> | undefined;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <tr
      ref={rowRef}
      aria-selected={picked}
      className={cn(
        "border-t border-[#F1F2F4] dark:border-border",
        row.isMine && "bg-[#FFFBEB] dark:bg-[#2A2210]",
        picked && PICKED_ROW_CLASS
      )}
      data-testid={`grid-row-${row.teamKey}`}
    >
      <th scope="row" className={cn(STICKY, row.isMine && MINE_STICKY, "p-0 text-left")}>
        <button
          type="button"
          onClick={onOpen}
          data-testid={`grid-team-${row.teamKey}`}
          title={row.teamName}
          className="flex min-h-11 w-full min-w-0 flex-col justify-center rounded-[6px] px-1 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="w-full truncate text-xs font-semibold">
            {row.teamName}
            {row.isMine && <span className="sr-only"> (you)</span>}
          </span>
          {row.total !== null && (
            <span
              className="text-[11px] font-normal text-muted-foreground tabular-nums"
              data-testid="row-total"
            >
              {row.total}
            </span>
          )}
        </button>
      </th>
      {row.cells.map((cell) => (
        <Cell key={cell.statId} cell={cell} />
      ))}
    </tr>
  );
}

/** The header row: one button per category, which picks it or, when picked, clears it. */
function Head({ grid, onPick }: { grid: CategoryGrid; onPick: (category: string | null) => void }) {
  return (
    <thead>
      <tr>
        <th
          scope="col"
          className={cn(
            STICKY,
            "h-9 min-w-[96px] px-1 text-left text-[11px] font-normal text-muted-foreground"
          )}
        >
          Rank in each
        </th>
        {grid.categories.map((item) => {
          const picked = item === grid.picked;
          return (
            <th
              key={item.statId}
              scope="col"
              aria-sort={picked ? "ascending" : "none"}
              className="w-7 px-px"
            >
              <button
                type="button"
                onClick={() => onPick(picked ? null : item.statId)}
                className={cn(
                  "min-h-9 w-full rounded-[6px] text-[9px] font-bold text-[#4B5563] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:text-muted-foreground",
                  picked &&
                    "text-[#15181D] shadow-[inset_0_0_0_2px_#15181D] dark:text-foreground dark:shadow-[inset_0_0_0_2px_white]"
                )}
              >
                {categoryLabel(item)}
              </button>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * Categories: each team's rank in each of the league's categories, top three
 * green and bottom three red. A header sorts by its category and shows its
 * totals; the same header again goes back to the standings order. With many
 * categories the grid scrolls sideways inside its card.
 */
export function CategoryRankGrid({
  table,
  myTeamKey,
  category,
  pickedTeamKey,
  heading,
  onPick,
  onOpenTeam,
}: CategoryRankGridProps) {
  const pickedRow = useRef<HTMLTableRowElement>(null);
  useKeepInView(pickedRow, category ?? "");
  const grid = useMemo(
    () => categoryGrid(table, myTeamKey, category),
    [table, myTeamKey, category]
  );
  return (
    <section
      className="overflow-x-auto rounded-2xl border border-[#E2E5EA] bg-white px-2 pb-1 pt-0.5 dark:border-border dark:bg-card"
      data-testid="card-league-categories"
    >
      {heading !== null && <h2 className={cn(CARD_HEADING_CLASS, "sticky left-0")}>{heading}</h2>}
      <table
        className="w-full border-collapse"
        style={{ minWidth: `${96 + grid.categories.length * 28}px` }}
        aria-label="Category ranks"
      >
        <Head grid={grid} onPick={onPick} />
        <tbody>
          {grid.rows.map((row) => (
            <Row
              key={row.teamKey}
              row={row}
              picked={pickedState(pickedTeamKey, row.teamKey)}
              rowRef={row.teamKey === pickedTeamKey ? pickedRow : undefined}
              onOpen={(event) => onOpenTeam(row.teamKey, event)}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}
