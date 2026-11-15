import { useMemo, type MouseEvent } from "react";
import type { AllPlayTable, TeamTable } from "@shared/domain";
import { useSeasonWeekTables } from "@/api/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/features/league/ErrorScreen";
import type { StandingsSort } from "@/features/league/league-board-state";
import { cn } from "@/lib/utils";
import {
  luckText,
  ordinal,
  seasonAllPlayOf,
  standingsRows,
  weekAllPlay,
  type StandingsRow,
} from "./league-standings-model";
import { BADGE_TONE_CLASS, rankText } from "./rank-tone";

interface StandingsTableProps {
  table: TeamTable;
  leagueKey: string;
  myTeamKey: string;
  sort: StandingsSort;
  onSort: (sort: StandingsSort) => void;
  onOpenTeam: (teamKey: string, event: MouseEvent<HTMLButtonElement>) => void;
  onPickLeague: () => void;
}

/** All-play for the table's period, as the columns need it: ready, still loading, or failed. */
interface AllPlayState {
  readonly table: AllPlayTable | null;
  readonly error: Error | null;
  readonly retry: () => void;
}

/**
 * A week's all-play comes from its own table. The season's adds up every
 * week's table, which loads only while the season standings are on screen.
 */
function useAllPlay(table: TeamTable, leagueKey: string): AllPlayState {
  const season = table.scope.kind === "season";
  const { startWeek, currentWeek } = table.settings;
  const weeks = useSeasonWeekTables(
    season ? leagueKey : null,
    season ? { startWeek, currentWeek } : null
  );
  const allPlay = useMemo(() => {
    if (!season) {
      return weekAllPlay(table);
    }
    return weeks.data ? seasonAllPlayOf(weeks.data) : null;
  }, [season, table, weeks.data]);
  return {
    table: allPlay,
    error: season ? weeks.error : null,
    retry: () => void weeks.refetch(),
  };
}

/** The sortable columns. Places sort best first (ascending); luck sorts luckiest first. */
const COLUMNS: readonly {
  sort: StandingsSort;
  label: string;
  order: "ascending" | "descending";
}[] = [
  { sort: "record", label: "W–L–T", order: "ascending" },
  { sort: "all-play", label: "All-play", order: "ascending" },
  { sort: "luck", label: "Luck", order: "descending" },
];

const HEAD_CLASS = "h-9 text-[10px] font-bold text-[#4B5563] dark:text-muted-foreground";

function SortHeader({
  column,
  active,
  onSort,
}: {
  column: (typeof COLUMNS)[number];
  active: boolean;
  onSort: () => void;
}) {
  return (
    <th scope="col" aria-sort={active ? column.order : "none"} className={cn(HEAD_CLASS, "px-0")}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "min-h-8 w-full rounded-[6px] text-right focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-[#15181D] underline underline-offset-[3px] dark:text-foreground"
        )}
      >
        {column.label}
      </button>
    </th>
  );
}

/** What an all-play column shows while all-play loads or after it failed. */
function Pending({ failed }: { failed: boolean }) {
  return failed ? <span>—</span> : <Skeleton className="ml-auto h-4 w-7" aria-hidden="true" />;
}

function luckCell(luck: number | null): string {
  return luck === null ? "—" : luckText(luck);
}

/** The all-play place and luck, which wait for all-play and give way to its error. */
function AllPlayCells({ row, allPlay }: { row: StandingsRow; allPlay: AllPlayState }) {
  const known = allPlay.table !== null;
  const pending = <Pending failed={allPlay.error !== null} />;
  return (
    <>
      <td className="text-right" data-testid="row-all-play">
        {known ? (
          <span
            className={cn(
              "rounded-[6px] px-1.5 py-0.5 text-xs font-bold",
              BADGE_TONE_CLASS[row.allPlayTone]
            )}
          >
            {row.allPlayRank === null ? "—" : ordinal(row.allPlayRank)}
          </span>
        ) : (
          pending
        )}
      </td>
      <td
        className={cn(
          "text-right text-xs tabular-nums text-[#4B5563] dark:text-muted-foreground",
          row.luck !== null &&
            Math.abs(row.luck) >= 2 &&
            "font-extrabold text-[#15181D] dark:text-foreground"
        )}
        data-testid="row-luck"
      >
        {known ? luckCell(row.luck) : pending}
      </td>
    </>
  );
}

function Row({
  row,
  allPlay,
  onOpen,
}: {
  row: StandingsRow;
  allPlay: AllPlayState;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <tr
      className={cn(
        "border-t border-[#F1F2F4] dark:border-border",
        row.isMine && "bg-[#FFFBEB] dark:bg-amber-950/40"
      )}
      data-testid={`standings-row-${row.teamKey}`}
    >
      <td className="py-1 text-center">
        <span
          className={cn(
            "block rounded-[6px] py-[3px] text-sm font-extrabold",
            BADGE_TONE_CLASS[row.tone]
          )}
          data-testid="row-rank"
        >
          {rankText(row.rank)}
        </span>
      </td>
      <th scope="row" className="min-w-0 p-0 text-left font-semibold">
        <button
          type="button"
          onClick={onOpen}
          data-testid={`row-ranking-${row.teamKey}`}
          className="block min-h-11 w-full truncate rounded-[6px] px-1 text-left text-[13px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.teamName}
          {row.isMine && <span className="sr-only"> (you)</span>}
        </button>
      </th>
      <td
        className="whitespace-nowrap text-right text-[12.5px] font-bold tabular-nums"
        data-testid="row-record"
      >
        {row.record}
      </td>
      <AllPlayCells row={row} allPlay={allPlay} />
    </tr>
  );
}

function Head({ sort, onSort }: { sort: StandingsSort; onSort: (sort: StandingsSort) => void }) {
  return (
    <>
      <colgroup>
        <col className="w-6" />
        <col />
        <col className="w-[62px]" />
        <col className="w-[54px]" />
        <col className="w-11" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={cn(HEAD_CLASS, "text-center")}>
            #
          </th>
          <th scope="col" className={cn(HEAD_CLASS, "px-1 text-left")}>
            Team
          </th>
          {COLUMNS.map((column) => (
            <SortHeader
              key={column.sort}
              column={column}
              active={column.sort === sort}
              onSort={() => onSort(column.sort)}
            />
          ))}
        </tr>
      </thead>
    </>
  );
}

/**
 * Standings: every team in official order (record win %, a tie as half) with
 * its W–L–T, all-play place and luck. Each of those headers sorts by it.
 */
export function StandingsTable({
  table,
  leagueKey,
  myTeamKey,
  sort,
  onSort,
  onOpenTeam,
  onPickLeague,
}: StandingsTableProps) {
  const allPlay = useAllPlay(table, leagueKey);
  const rows = useMemo(
    () => standingsRows(table, myTeamKey, allPlay.table, sort),
    [table, myTeamKey, allPlay.table, sort]
  );
  return (
    <section
      className="rounded-2xl border border-[#E2E5EA] bg-white px-3 pb-1 pt-0.5 dark:border-border dark:bg-card"
      data-testid="card-league-standings"
    >
      {allPlay.error && (
        <ErrorScreen
          inline
          error={allPlay.error}
          onRetry={allPlay.retry}
          onPickLeague={onPickLeague}
        />
      )}
      <table className="w-full table-fixed border-collapse" aria-label="Standings">
        <Head sort={sort} onSort={onSort} />
        <tbody>
          {rows.map((row) => (
            <Row
              key={row.teamKey}
              row={row}
              allPlay={allPlay}
              onOpen={(event) => onOpenTeam(row.teamKey, event)}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}
