import type { ReactNode } from "react";
import {
  categoryEntry,
  dayCallout,
  orderForCategory,
  type CategoryKey,
  type VersusAverage,
} from "@shared/domain";
import { CATEGORY_LABELS } from "@/features/league/categories";
import { cn } from "@/lib/utils";
import {
  averageText,
  cardMeta,
  entryText,
  isOutToday,
  shortName,
  type PlayerCardRow,
} from "./matchup-board";

/** One side of the board: a team's label and its players. */
export interface PlayerColumn {
  readonly teamKey: string;
  readonly label: string;
  readonly rows: readonly PlayerCardRow[];
}

interface PlayerColumnProps {
  column: PlayerColumn;
  category: CategoryKey;
  /** Whether the rows are today's: injury tags and "Out" describe today only. */
  isToday: boolean;
}

const CALLOUT_TEXT: Readonly<Record<VersusAverage, string>> = {
  better: "text-green-700 dark:text-green-400",
  worse: "text-red-700 dark:text-red-400",
  usual: "",
  unavailable: "",
};

const CALLOUT_NAME: Readonly<Record<VersusAverage, string>> = {
  better: ", above average",
  worse: ", below average",
  usual: "",
  unavailable: "",
};

function PlayerCard({
  row,
  category,
  isToday,
}: {
  row: PlayerCardRow;
  category: CategoryKey;
  isToday: boolean;
}) {
  const entry = categoryEntry(row.line, category);
  const value = entryText(entry, isOutToday(row.player, isToday));
  const callout = dayCallout(
    category,
    entry,
    row.average,
    row.isStartingSlot,
    row.game?.state.kind === "live"
  );
  const injury = isToday ? row.player.injuryToday : null;
  const meta = cardMeta(row);
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-0.5 rounded-[10px] border p-2",
        !row.isStartingSlot && "border-dashed bg-muted"
      )}
      data-testid={`player-card-${row.player.playerKey}`}
      aria-label={`${row.player.name}, ${CATEGORY_LABELS[category]} ${value}${CALLOUT_NAME[callout]}, ${meta}`}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-xs font-bold">{shortName(row.player.name)}</span>
        {injury && (
          <span className="shrink-0 rounded-md border border-red-700/40 px-1 text-[0.625rem] font-bold text-red-700 dark:border-red-400/40 dark:text-red-400">
            {injury.designation}
          </span>
        )}
      </span>
      <span
        className={cn(
          "text-right tabular-nums",
          entry.kind === "value"
            ? "text-base font-extrabold"
            : "text-xs font-semibold italic text-muted-foreground",
          CALLOUT_TEXT[callout]
        )}
        data-testid="card-value"
        data-callout={callout}
      >
        {value}
      </span>
      <span className="col-span-2 truncate text-[0.6875rem] text-muted-foreground">{meta}</span>
      <span className="col-span-2 truncate text-[0.6875rem] text-muted-foreground">
        {averageText(category, entry, row.average)}
      </span>
    </li>
  );
}

/** One team's column: counted players, then bench and IL set apart. */
export function PlayerColumnView({ column, category, isToday }: PlayerColumnProps) {
  const ordered = orderForCategory(column.rows, category);
  const counted = ordered.filter((row) => row.isStartingSlot);
  const bench = ordered.filter((row) => !row.isStartingSlot);
  const card = (row: PlayerCardRow) => (
    <PlayerCard key={row.player.playerKey} row={row} category={category} isToday={isToday} />
  );
  return (
    <section
      aria-label={column.label}
      className="min-w-0 space-y-1.5"
      data-testid={`column-${column.teamKey}`}
    >
      <h3 className="truncate text-xs font-semibold">{column.label}</h3>
      <ul className="space-y-1.5" data-testid="counted-players">
        {counted.map(card)}
      </ul>
      {bench.length > 0 && (
        <>
          <h4 className="border-t border-dashed pt-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-muted-foreground">
            Bench &amp; IL · not counted
          </h4>
          <ul className="space-y-1.5" data-testid="bench-players">
            {bench.map(card)}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * Both rosters side by side, two columns at every width. Each column is
 * sorted on its own so players aren't paired.
 */
export function PlayerColumns({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5" data-testid="player-columns">
      {children}
    </div>
  );
}
