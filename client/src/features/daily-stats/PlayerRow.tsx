import type { LeagueCategory, TeamSchedule } from "@shared/domain";
import { categoriesPerRow } from "@/features/league/categories";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { cn } from "@/lib/utils";
import { InjuryTag } from "./InjuryTag";
import {
  averageCells,
  gamesLeftText,
  isInactive,
  ownershipText,
  rosteredChangeText,
  rosteredText,
  weekStrip,
  type AverageTone,
  type ListedPlayer,
  type PlayerTotals,
} from "./players-model";

interface PlayerRowProps {
  row: ListedPlayer;
  /** The period's totals; null while they load or when Yahoo has none for the player. */
  totals: PlayerTotals | null;
  /** The season's totals to colour the period against; null for the season itself. */
  season: PlayerTotals | null;
  /** The player's NBA team's schedule; undefined when the schedule doesn't cover the team. */
  schedule: TeamSchedule | undefined;
  /** Today's US Eastern date, for the week strip. */
  today: string;
  /** The category the list is sorted on, highlighted on every card. */
  sortedCategory: LeagueCategory | null;
  /** The league's categories, one average each. */
  categories: readonly LeagueCategory[];
  /** The player whose details the panel beside the list shows, from lg. */
  selected: boolean;
  onOpen: (player: DailyPlayer) => void;
}

const TAG = "shrink-0 whitespace-nowrap rounded-md px-1.5 py-px text-[0.625rem] font-bold";

/** The first line: name (opening the detail), injury tag, positions and team, then who has them. */
function CardTitle({ row, selected, onOpen }: Pick<PlayerRowProps, "row" | "selected" | "onOpen">) {
  const { player, ownership } = row;
  const owner = ownershipText(ownership);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-[5px] gap-y-1 md:col-start-1">
      {/* The name's hit area stretches over the whole card, as in the mockup; the injury tag sits above it. */}
      <button
        type="button"
        onClick={() => onOpen(player)}
        title={player.name}
        aria-current={selected || undefined}
        className={cn(
          "max-w-[150px] truncate text-left text-[0.8125rem] font-semibold underline decoration-border underline-offset-[3px]",
          "after:absolute after:inset-0 after:rounded-2xl after:content-['']",
          "focus-visible:outline-hidden focus-visible:after:ring-2 focus-visible:after:ring-ring"
        )}
      >
        {player.name}
      </button>
      <span className="relative z-10 inline-flex">
        <InjuryTag player={player} compact />
      </span>
      <span className="whitespace-nowrap text-[0.6875rem] text-muted-foreground">
        <span data-testid="player-positions">{player.positions.join(", ")}</span> · {player.nbaTeam}
      </span>
      {isInactive(player) && (
        <span className={cn(TAG, "bg-muted text-muted-foreground")}>Inactive</span>
      )}
      {owner && (
        <span
          className={cn(
            TAG,
            "max-w-[120px] truncate",
            ownership.kind === "waivers"
              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
              : "bg-muted text-foreground/80"
          )}
          data-testid="ownership"
        >
          {owner}
        </span>
      )}
    </div>
  );
}

/** The second line: the week's game days, games left, and rostered % with this week's change. */
function CardFacts({ row, schedule, today }: Pick<PlayerRowProps, "row" | "schedule" | "today">) {
  const change = row.rostered.change;
  return (
    <div className="flex min-w-0 items-center gap-2 text-[0.6875rem] md:contents">
      {schedule && (
        <span className="contents md:col-start-2 md:flex md:flex-col md:items-start md:gap-0.5">
          <span className="flex gap-0.5" data-testid="week-strip">
            {weekStrip(schedule, today).map((day) => (
              <span
                key={day.date}
                className={cn(
                  "flex h-[17px] w-[17px] items-center justify-center rounded-md text-[0.5625rem] font-bold",
                  day.plays ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                  day.past && "opacity-45",
                  day.today && "outline outline-2 outline-[#F5C518]"
                )}
              >
                <span aria-hidden>{day.letter}</span>
                <span className="sr-only">{`${day.name}: ${day.plays ? "game" : "no game"}`}</span>
              </span>
            ))}
          </span>
          <span className="whitespace-nowrap text-muted-foreground" data-testid="games-left">
            {gamesLeftText(schedule)}
          </span>
        </span>
      )}
      <span className="ml-auto whitespace-nowrap text-right md:col-start-3" data-testid="rostered">
        <b className="font-semibold">{rosteredText(row.rostered)}</b>
        {/* From md the column header says "Rostered". */}
        <span className="md:sr-only"> rostered</span>{" "}
        <span
          className={cn(
            "font-bold",
            change > 0 && "text-green-700 dark:text-green-400",
            change < 0 && "text-red-600 dark:text-red-400"
          )}
        >
          {rosteredChangeText(change)}
        </span>
      </span>
    </div>
  );
}

const TONE_CLASS: Readonly<Record<NonNullable<AverageTone>, string>> = {
  better: "font-bold text-green-700 dark:text-green-400",
  worse: "font-bold text-red-600 dark:text-red-400",
};

/** One player card: who they are and who has them, their week, and the period's average in each category. */
export function PlayerRow({
  row,
  totals,
  season,
  schedule,
  today,
  sortedCategory,
  categories,
  selected,
  onOpen,
}: PlayerRowProps) {
  return (
    <li
      className={cn(
        "relative flex min-w-0 flex-col gap-[5px] rounded-2xl border bg-card px-3 py-2.5",
        "md:grid md:grid-cols-(--player-columns) md:items-center md:gap-x-1.5 md:rounded-xl md:py-2",
        row.ownership.kind === "waivers" &&
          "border-amber-300 bg-amber-50 dark:border-amber-400/50 dark:bg-amber-950/30",
        selected && "outline-2 outline-foreground"
      )}
      data-testid={`player-row-${row.player.playerKey}`}
    >
      <CardTitle row={row} selected={selected} onOpen={onOpen} />
      <CardFacts row={row} schedule={schedule} today={today} />
      <dl
        className="grid gap-0.5 md:contents"
        style={{
          gridTemplateColumns: `repeat(${categoriesPerRow(categories.length)}, minmax(0, 1fr))`,
        }}
        data-testid="player-averages"
      >
        {averageCells(categories, totals, season).map((cell) => (
          <div
            key={cell.key}
            className={cn(
              "flex min-w-0 flex-col items-center gap-px rounded-md py-1",
              cell.key === sortedCategory?.statId
                ? "bg-amber-100 dark:bg-amber-900/40"
                : "bg-muted/60 dark:bg-muted/40"
            )}
          >
            <dt className="text-[0.53125rem] font-bold tracking-[0.2px] text-muted-foreground md:sr-only">
              {cell.label}
            </dt>
            <dd
              className={cn(
                "whitespace-nowrap text-[0.71875rem] tabular-nums",
                cell.tone && TONE_CLASS[cell.tone]
              )}
            >
              {cell.text}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
