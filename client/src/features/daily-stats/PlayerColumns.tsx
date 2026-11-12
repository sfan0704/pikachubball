import type { ReactNode } from "react";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import {
  categoryEntry,
  dayCallout,
  orderForCategory,
  type CategoryKey,
  type VersusAverage,
} from "@shared/domain";
import { CATEGORY_LABELS } from "@/features/league/categories";
import { cn } from "@/lib/utils";
import { InjuryTag } from "./InjuryTag";
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
  /** Opens the shared player detail. */
  onOpenPlayer: (player: DailyPlayer) => void;
}

const CALLOUT_TEXT: Readonly<Record<VersusAverage, string>> = {
  better: "text-[#15803D] dark:text-green-400",
  worse: "text-[#DC2626] dark:text-red-400",
  usual: "",
  unavailable: "",
};

const CALLOUT_NAME: Readonly<Record<VersusAverage, string>> = {
  better: ", above average",
  worse: ", below average",
  usual: "",
  unavailable: "",
};

/** The card's player name, which opens the shared player detail. */
function CardName({
  player,
  onOpenPlayer,
}: {
  player: DailyPlayer;
  onOpenPlayer: (player: DailyPlayer) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenPlayer(player)}
      aria-label={`${player.name}: open player detail`}
      className="truncate rounded-md text-left text-xs font-bold text-[#15181D] dark:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {shortName(player.name)}
    </button>
  );
}

function PlayerCard({
  row,
  category,
  isToday,
  onOpenPlayer,
}: {
  row: PlayerCardRow;
  category: CategoryKey;
  isToday: boolean;
  onOpenPlayer: (player: DailyPlayer) => void;
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
  const meta = cardMeta(row);
  return (
    <li
      className={cn(
        "grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-0.5 rounded-[10px] border border-[#E2E5EA] bg-white p-2 dark:border-border dark:bg-card",
        !row.isStartingSlot &&
          "border-dashed border-[#9CA3AF] bg-[#F3F4F6] dark:border-muted-foreground dark:bg-muted"
      )}
      data-testid={`player-card-${row.player.playerKey}`}
      aria-label={`${row.player.name}, ${CATEGORY_LABELS[category]} ${value}${CALLOUT_NAME[callout]}, ${meta}`}
    >
      <span className="flex min-w-0 items-center gap-1">
        <CardName player={row.player} onOpenPlayer={onOpenPlayer} />
        {isToday && <InjuryTag player={row.player} compact />}
      </span>
      <span
        className={cn(
          "text-right tabular-nums",
          entry.kind === "value"
            ? "text-[17px] font-extrabold"
            : "text-xs font-semibold italic text-[#4B5563] dark:text-muted-foreground",
          CALLOUT_TEXT[callout]
        )}
        data-testid="card-value"
        data-callout={callout}
      >
        {value}
      </span>
      <span className="truncate text-[10.5px] text-[#4B5563] dark:text-muted-foreground">
        {meta}
      </span>
      <span className="whitespace-nowrap text-right text-[10px] text-[#4B5563] dark:text-muted-foreground">
        {averageText(category, entry, row.average)}
      </span>
    </li>
  );
}

/** A column's heading: the team, and how many of its players are listed. */
export function ColumnHead({ label, count }: { label: string; count: string }) {
  return (
    <h3 className="flex justify-between gap-1 border-b border-[#E2E5EA] pb-1 text-[11px] font-bold text-[#374151] dark:border-border dark:text-muted-foreground">
      <span className="truncate">{label}</span>
      <span className="shrink-0">{count}</span>
    </h3>
  );
}

/** A set-apart group within a column, such as the bench or dropped players. */
export function GroupHead({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-1 border-t border-dashed border-[#9CA3AF] pt-1.5 text-[10px] font-bold uppercase tracking-[0.4px] text-[#4B5563] dark:text-muted-foreground">
      {children}
    </h4>
  );
}

/** One team's column: counted players, then bench and IL set apart. */
export function PlayerColumnView({ column, category, isToday, onOpenPlayer }: PlayerColumnProps) {
  const ordered = orderForCategory(column.rows, category);
  const counted = ordered.filter((row) => row.isStartingSlot);
  const bench = ordered.filter((row) => !row.isStartingSlot);
  const card = (row: PlayerCardRow) => (
    <PlayerCard
      key={row.player.playerKey}
      row={row}
      category={category}
      isToday={isToday}
      onOpenPlayer={onOpenPlayer}
    />
  );
  return (
    <section
      aria-label={column.label}
      className="min-w-0 space-y-1.5"
      data-testid={`column-${column.teamKey}`}
    >
      <ColumnHead label={column.label} count={`${counted.length} counted`} />
      <ul className="space-y-1.5" data-testid="counted-players">
        {counted.map(card)}
      </ul>
      {bench.length > 0 && (
        <>
          <GroupHead>Bench &amp; IL · not counted</GroupHead>
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
    <div className="mt-2 grid grid-cols-2 gap-2.5" data-testid="player-columns">
      {children}
    </div>
  );
}
