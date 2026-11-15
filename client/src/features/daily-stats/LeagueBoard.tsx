import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { TeamTable } from "@shared/domain";
import type { LeagueBoardState, LeagueView } from "@/features/league/league-board-state";
import { LinkBar } from "./LinkBar";
import { CategoryRankGrid } from "./CategoryRankGrid";
import { officialRecords, recordText } from "./league-standings-model";
import { StandingsTable } from "./StandingsTable";
import { TeamPopover } from "./TeamPopover";

interface LeagueBoardProps {
  table: TeamTable;
  leagueKey: string;
  myTeamKey: string;
  /** The chosen period as the period picker names it, for example "Week 3". */
  periodLabel: string;
  /** The view, sort and picked category, as the URL holds them. */
  board: LeagueBoardState;
  /** The URL that shows another board, for the view links. */
  boardHref: (board: LeagueBoardState) => string;
  /** Moves to another board, keeping it in the history so back restores this one. */
  onBoard: (board: LeagueBoardState) => void;
  onPickLeague: () => void;
}

const VIEW_LABELS: Readonly<Record<LeagueView, string>> = {
  standings: "Standings",
  categories: "Categories",
};

/**
 * League for one period: the Standings | Categories bar, then the standings
 * table or the category rank grid. Tapping a team opens its ranks, totals and roster.
 */
export function LeagueBoard({
  table,
  leagueKey,
  myTeamKey,
  periodLabel,
  board,
  boardHref,
  onBoard,
  onPickLeague,
}: LeagueBoardProps) {
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  // The popover has no trigger of its own, so focus goes back to the row that opened it.
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = (teamKey: string, event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setOpenTeam(teamKey);
  };
  const records = useMemo(() => officialRecords(table), [table]);
  const views = (Object.keys(VIEW_LABELS) as LeagueView[]).map((view) => ({
    key: view,
    label: VIEW_LABELS[view],
    href: boardHref({ ...board, view }),
    current: view === board.view,
  }));
  return (
    <div className="space-y-3" data-testid="card-league-rankings">
      <LinkBar label="League view" items={views} testId="league-view-bar" />
      {board.view === "standings" ? (
        <StandingsTable
          table={table}
          leagueKey={leagueKey}
          myTeamKey={myTeamKey}
          sort={board.sort}
          onSort={(sort) => onBoard({ ...board, sort })}
          onOpenTeam={open}
          onPickLeague={onPickLeague}
        />
      ) : (
        <CategoryRankGrid
          table={table}
          myTeamKey={myTeamKey}
          category={board.category}
          onPick={(category) => onBoard({ ...board, category })}
          onOpenTeam={open}
        />
      )}
      {openTeam !== null && (
        <TeamPopover
          table={table}
          leagueKey={leagueKey}
          teamKey={openTeam}
          record={recordText(records[openTeam])}
          periodLabel={periodLabel}
          onClose={() => setOpenTeam(null)}
          returnFocus={() => opener.current?.focus()}
          onPickLeague={onPickLeague}
        />
      )}
    </div>
  );
}
