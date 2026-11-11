import { useMemo, useRef, useState, type MouseEvent } from "react";
import { Info } from "lucide-react";
import type { TeamTable } from "@shared/domain";
import { useLeagueScope } from "@/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { rankText, TONE_CLASS } from "./rank-tone";
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
        "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[10px] border px-0.5 py-1.5",
        TONE_CLASS[tile.tone],
        picked && "ring-2 ring-inset ring-foreground"
      )}
    >
      <span className="text-[11px] font-medium leading-none">{tile.label}</span>
      <span className="text-lg font-extrabold leading-tight">
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
            "flex min-w-0 flex-col items-center rounded-[6px] py-1",
            TONE_CLASS[cell.tone]
          )}
        >
          <span className="text-[9px] leading-none">{cell.label}</span>
          <span className="text-[10.5px] font-bold leading-tight tracking-tighter">
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
    <li>
      <button
        type="button"
        onClick={onOpen}
        data-testid={`row-ranking-${row.teamKey}`}
        className={cn(
          "flex w-full flex-col gap-1.5 rounded-[6px] px-1 py-2 text-left",
          row.isMine && "bg-amber-50 dark:bg-amber-950/40"
        )}
      >
        <span className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2">
          <span
            className={cn(
              "rounded-[6px] py-0.5 text-center text-sm font-extrabold",
              TONE_CLASS[row.tone]
            )}
            data-testid="row-rank"
          >
            {rankText(row.rank)}
          </span>
          <span className="truncate text-sm font-semibold">
            {row.teamName}
            {row.isMine && <span className="sr-only"> (you)</span>}
          </span>
          <span className="text-sm tabular-nums" data-testid="row-value">
            {row.value}
          </span>
        </span>
        {row.cells && <Cells cells={row.cells} />}
      </button>
    </li>
  );
}

function Explanation() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="How to read this"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <Info className="h-5 w-5" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 text-base font-bold">Category ranks</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-foreground">
          Every team in the league is ranked in each of the nine categories, using totals for the
          period you pick. 1 is best. The top three are green and the bottom three red. Overall adds
          up each team's category ranks, so a lower total is stronger. W–L–T is the season
          head-to-head record from Yahoo; the ranks are not Yahoo's official standings.
        </DialogDescription>
        <p className="text-sm text-muted-foreground">
          Tied teams share a rank and the next one is skipped (1, 1, 3).
        </p>
      </DialogContent>
    </Dialog>
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
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" data-testid="board-title">
              {title}
            </h2>
            <Explanation />
          </div>
          <ul className="divide-y divide-border" aria-label={`${title} ranking`}>
            {rows.map((row) => (
              <Row key={row.teamKey} row={row} onOpen={open(row.teamKey)} />
            ))}
          </ul>
        </CardContent>
      </Card>
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
