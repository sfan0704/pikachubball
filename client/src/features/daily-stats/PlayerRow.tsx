import type { PlayerStatsResponse } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import type { TeamSchedule } from "@shared/domain";
import { cn } from "@/lib/utils";
import { PlayerButton } from "./PlayerButton";
import {
  averageCells,
  isInactive,
  ownershipText,
  rosteredChangeText,
  rosteredText,
  type ListedPlayer,
} from "./players-model";

interface PlayerRowProps {
  row: ListedPlayer;
  /** The period's totals; null while they load or when Yahoo has none for the player. */
  totals: PlayerStatsResponse["players"][number] | null;
  /** The player's NBA team's schedule; undefined when the schedule doesn't cover the team. */
  schedule: TeamSchedule | undefined;
  onOpen: (player: DailyPlayer) => void;
}

function gamesLeftText(schedule: TeamSchedule | undefined): string | null {
  if (schedule === undefined) {
    return null;
  }
  const left = schedule.gamesLeftThisWeek;
  return `${left} ${left === 1 ? "game" : "games"} left this week`;
}

/** The row's second line: rostered % and its weekly change, then games left this week. */
function RowFacts({ row, schedule }: Pick<PlayerRowProps, "row" | "schedule">) {
  const gamesLeft = gamesLeftText(schedule);
  const change = row.rostered.change;
  return (
    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
      <span data-testid="rostered">
        <b className="font-semibold text-foreground">{rosteredText(row.rostered)}</b> rostered,{" "}
        <span
          className={cn(
            change > 0 && "text-green-700 dark:text-green-400",
            change < 0 && "text-red-700 dark:text-red-400"
          )}
        >
          {rosteredChangeText(change)}
        </span>{" "}
        this week
      </span>
      {gamesLeft && <span data-testid="games-left">{gamesLeft}</span>}
    </p>
  );
}

/** One player of the list: who they are, who has them, rostered %, games left and the period's averages. */
export function PlayerRow({ row, totals, schedule, onOpen }: PlayerRowProps) {
  const owner = ownershipText(row.ownership);
  const onWaivers = row.ownership.kind === "waivers";
  return (
    <li
      className={cn(
        "min-w-0 space-y-2 rounded-[10px] border p-3",
        onWaivers && "border-amber-600/60 bg-amber-50 dark:border-amber-400/50 dark:bg-amber-950/30"
      )}
      data-testid={`player-row-${row.player.playerKey}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Players lists today's pool, so the row shows today's injury tag. */}
        <PlayerButton player={row.player} showInjury onOpen={onOpen} />
        {isInactive(row.player) && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
            Inactive
          </span>
        )}
        {owner && (
          <span
            className={cn(
              "shrink-0 truncate text-xs",
              onWaivers
                ? "font-semibold text-amber-800 dark:text-amber-300"
                : "text-muted-foreground"
            )}
            data-testid="ownership"
          >
            {owner}
          </span>
        )}
      </div>
      <RowFacts row={row} schedule={schedule} />
      <dl className="grid grid-cols-9 gap-0.5 text-center" data-testid="player-averages">
        {averageCells(totals).map((cell) => (
          <div key={cell.key} className="min-w-0 rounded-md bg-muted px-0.5 py-1">
            <dt className="text-[0.625rem] text-muted-foreground">{cell.label}</dt>
            <dd className="text-[0.6875rem] font-semibold tabular-nums">{cell.text}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
