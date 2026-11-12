import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { TeamTable } from "@shared/domain";
import { useLeagueScope } from "@/api/hooks";
import { cn } from "@/lib/utils";
import {
  boardRows,
  boardTiles,
  recordText,
  type BoardCell,
  type BoardPick,
  type BoardRow,
  type BoardTile,
  type Records,
} from "./league-board-model";
import {
  BADGE_TONE_CLASS,
  RANK_TEXT_CLASS,
  rankText,
  TILE_TONE_CLASS,
  TONE_CLASS,
} from "./rank-tone";
import { TeamPopover } from "./TeamPopover";

interface LeagueBoardProps {
  table: TeamTable;
  leagueKey: string;
  myTeamKey: string;
  /** The chosen period as the period picker names it, for example "Week 3". */
  periodLabel: string;
  onPickLeague: () => void;
}

function Tile({ tile, picked, onPick }: { tile: BoardTile; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      data-testid={`tile-${tile.pick}`}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-[10px] border py-2",
        TILE_TONE_CLASS[tile.tone],
        picked && "shadow-[inset_0_0_0_2px_#15181D] dark:shadow-[inset_0_0_0_2px_white]"
      )}
    >
      <span className="text-[9px] font-bold tracking-[0.2px] text-[#4B5563] dark:text-muted-foreground">
        {tile.label}
      </span>
      <span className={cn("text-lg font-extrabold leading-tight", RANK_TEXT_CLASS[tile.tone])}>
        <span className="sr-only">your rank </span>
        {rankText(tile.rank)}
      </span>
    </button>
  );
}

function Tiles({
  tiles,
  pick,
  onPick,
}: {
  tiles: readonly BoardTile[];
  pick: BoardPick;
  onPick: (pick: BoardPick) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Rank by">
      {tiles.map((tile) => (
        <Tile
          key={tile.pick}
          tile={tile}
          picked={tile.pick === pick}
          onPick={() => onPick(tile.pick)}
        />
      ))}
    </div>
  );
}

function Cells({ cells }: { cells: readonly BoardCell[] }) {
  return (
    <span className="grid grid-cols-9 gap-0.5">
      {cells.map((cell) => (
        <span
          key={cell.key}
          className={cn(
            "flex min-w-0 flex-col items-center gap-px rounded-[6px] py-[5px]",
            TONE_CLASS[cell.tone]
          )}
        >
          <span className="text-[9.5px] font-bold leading-none text-[#4B5563] dark:text-muted-foreground">
            {cell.label}
          </span>
          <span className="whitespace-nowrap text-xs font-bold leading-tight tracking-[-0.3px]">
            {cell.text}
          </span>
        </span>
      ))}
    </span>
  );
}

function Row({
  row,
  onOpen,
}: {
  row: BoardRow;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li className="border-t border-[#F1F2F4] dark:border-border">
      <button
        type="button"
        onClick={onOpen}
        data-testid={`row-ranking-${row.teamKey}`}
        className={cn(
          "flex w-full flex-col gap-1.5 py-2 text-left",
          row.isMine && "rounded-[6px] bg-[#FFFBEB] dark:bg-amber-950/40"
        )}
      >
        <span className="grid w-full grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2">
          <span
            className={cn(
              "rounded-[6px] py-[3px] text-center text-sm font-extrabold",
              BADGE_TONE_CLASS[row.tone]
            )}
            data-testid="row-rank"
          >
            {rankText(row.rank)}
          </span>
          <span className="truncate text-[13px] font-semibold">
            {row.teamName}
            {row.isMine && <span className="sr-only"> (you)</span>}
          </span>
          <span className="text-right text-[13px] font-bold tabular-nums" data-testid="row-value">
            {row.value}
          </span>
        </span>
        {row.cells && <Cells cells={row.cells} />}
      </button>
    </li>
  );
}

/** The records come from the season standings, whatever period is shown. */
function useRecords(leagueKey: string): Records {
  const season = useLeagueScope(leagueKey, "season");
  return useMemo(
    () =>
      season.data ? new Map(season.data.teams.map((team) => [team.teamKey, team.record])) : null,
    [season.data]
  );
}

/**
 * League: ten tiles with the user's rank overall and in each category, which
 * select the list below; tapping a team opens its ranks, totals and roster.
 */
export function LeagueBoard({
  table,
  leagueKey,
  myTeamKey,
  periodLabel,
  onPickLeague,
}: LeagueBoardProps) {
  const [pick, setPick] = useState<BoardPick>("overall");
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  // The popover has no trigger of its own, so focus goes back to the row that opened it.
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = (teamKey: string) => (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setOpenTeam(teamKey);
  };
  const records = useRecords(leagueKey);
  const tiles = useMemo(() => boardTiles(table, myTeamKey), [table, myTeamKey]);
  const rows = useMemo(
    () => boardRows(table, myTeamKey, pick, records),
    [table, myTeamKey, pick, records]
  );
  const title = tiles.find((tile) => tile.pick === pick)?.label ?? "Overall";
  return (
    <div className="space-y-3" data-testid="card-league-rankings">
      <Tiles tiles={tiles} pick={pick} onPick={setPick} />
      <section className="rounded-2xl border border-[#E2E5EA] bg-white px-3 py-1 dark:border-border dark:bg-card">
        <h2
          className="flex min-h-8 items-center text-xs font-bold uppercase tracking-[0.5px] text-[#374151] dark:text-muted-foreground"
          data-testid="board-title"
        >
          {title}
        </h2>
        <ul aria-label={`${title} ranking`}>
          {rows.map((row) => (
            <Row key={row.teamKey} row={row} onOpen={open(row.teamKey)} />
          ))}
        </ul>
      </section>
      {openTeam !== null && (
        <TeamPopover
          table={table}
          leagueKey={leagueKey}
          teamKey={openTeam}
          record={recordText(records, openTeam)}
          periodLabel={periodLabel}
          onClose={() => setOpenTeam(null)}
          returnFocus={() => opener.current?.focus()}
          onPickLeague={onPickLeague}
        />
      )}
    </div>
  );
}
