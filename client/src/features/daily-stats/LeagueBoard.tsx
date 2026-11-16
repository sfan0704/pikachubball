import { useId, useRef, useState, type MouseEvent } from "react";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { nbaDateOf, type TeamTable } from "@shared/domain";
import type { LeagueBoardState, LeagueView } from "@/features/league/league-board-state";
import { useNow } from "@/features/league/useNow";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { CARD_HEADING_CLASS } from "./league-wide";
import { LinkBar } from "./LinkBar";
import { CategoryRankGrid } from "./CategoryRankGrid";
import { DetailsPanel } from "./DetailsPanel";
import { PlayerDetailSheet } from "./PlayerDetailSheet";
import { StandingsTable } from "./StandingsTable";
import { TeamDetails, teamName, TeamRoster } from "./TeamDetails";
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
  /** Whether refreshing the period's table failed; its error is already on screen. */
  tableFailed: boolean;
}

const VIEW_LABELS: Readonly<Record<LeagueView, string>> = {
  standings: "Standings",
  categories: "Categories",
};

/** The Standings | Categories links, each keeping the sort and picked category. */
function viewLinks(board: LeagueBoardState, boardHref: (board: LeagueBoardState) => string) {
  return (Object.keys(VIEW_LABELS) as LeagueView[]).map((view) => ({
    key: view,
    label: VIEW_LABELS[view],
    href: boardHref({ ...board, view }),
    current: view === board.view,
  }));
}

type OpenTeam = (teamKey: string, event: MouseEvent<HTMLButtonElement>) => void;

interface TablesProps extends LeagueBoardProps {
  /** The team outlined in both tables on a wide screen; null on a phone. */
  pickedTeamKey: string | null;
  onOpenTeam: OpenTeam;
}

function Standings({ pickedTeamKey, onOpenTeam, ...board }: TablesProps) {
  return (
    <StandingsTable
      table={board.table}
      leagueKey={board.leagueKey}
      myTeamKey={board.myTeamKey}
      sort={board.board.sort}
      pickedTeamKey={pickedTeamKey}
      heading={pickedTeamKey === null ? null : VIEW_LABELS.standings}
      onSort={(sort) => board.onBoard({ ...board.board, sort })}
      onOpenTeam={onOpenTeam}
      onPickLeague={board.onPickLeague}
      tableFailed={board.tableFailed}
    />
  );
}

function Categories({ pickedTeamKey, onOpenTeam, ...board }: TablesProps) {
  return (
    <CategoryRankGrid
      table={board.table}
      myTeamKey={board.myTeamKey}
      category={board.board.category}
      pickedTeamKey={pickedTeamKey}
      heading={pickedTeamKey === null ? null : VIEW_LABELS.categories}
      onPick={(category) => board.onBoard({ ...board.board, category })}
      onOpenTeam={onOpenTeam}
    />
  );
}

interface RosterCardProps {
  table: TeamTable;
  leagueKey: string;
  teamKey: string;
  onPickLeague: () => void;
}

/** The picked team's roster in a card across the page; a player opens their details in the drawer. */
function RosterCard({ table, leagueKey, teamKey, onPickLeague }: RosterCardProps) {
  const [openPlayer, setOpenPlayer] = useState<DailyPlayer | null>(null);
  const today = nbaDateOf(useNow());
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-[#E2E5EA] bg-white px-5 pb-3 dark:border-border dark:bg-card lg:col-span-3"
      data-testid="card-league-roster"
    >
      <h2 id={headingId} className={CARD_HEADING_CLASS}>
        Roster · {teamName(table, teamKey)}
      </h2>
      <TeamRoster
        leagueKey={leagueKey}
        teamKey={teamKey}
        onPickLeague={onPickLeague}
        onOpenPlayer={setOpenPlayer}
      />
      <PlayerDetailSheet
        leagueKey={leagueKey}
        player={openPlayer}
        viewDate={today}
        side="right"
        onClose={() => setOpenPlayer(null)}
        onPickLeague={onPickLeague}
      />
    </section>
  );
}

/**
 * From md: Standings, Categories and the picked team's details all on the page
 * (my team until another is picked), its roster in a card below. One column
 * at md; from lg the three side by side with the roster across them.
 */
function WideBoard(props: TablesProps & { pickedTeamKey: string }) {
  const { table, leagueKey, pickedTeamKey, periodLabel, onPickLeague } = props;
  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_minmax(0,5fr)]"
      data-testid="card-league-rankings"
    >
      <Standings {...props} />
      <Categories {...props} />
      <DetailsPanel testId="team-panel">
        <TeamDetails
          table={table}
          leagueKey={leagueKey}
          teamKey={pickedTeamKey}
          periodLabel={periodLabel}
          allPlayErrorShown
          onPickLeague={onPickLeague}
        />
      </DetailsPanel>
      <RosterCard
        table={table}
        leagueKey={leagueKey}
        teamKey={pickedTeamKey}
        onPickLeague={onPickLeague}
      />
    </div>
  );
}

/**
 * League for one period. On a phone: the Standings | Categories bar, then the
 * standings table or the category rank grid; tapping a team opens its sheet.
 * From md both tables and the team's details are on the page instead.
 */
export function LeagueBoard(props: LeagueBoardProps) {
  const { table, leagueKey, myTeamKey, periodLabel, board, boardHref, onPickLeague } = props;
  const wide = useBreakpoint() !== "phone";
  // Kept across widths: narrowing with a team picked opens its sheet; the default pick is not a pick.
  const [pickedTeam, setPickedTeam] = useState<string | null>(null);
  // The sheet has no trigger of its own, so focus goes back to the row that opened it.
  const opener = useRef<HTMLButtonElement | null>(null);
  const open: OpenTeam = (teamKey, event) => {
    opener.current = event.currentTarget;
    setPickedTeam(teamKey);
  };
  if (wide) {
    return <WideBoard {...props} pickedTeamKey={pickedTeam ?? myTeamKey} onOpenTeam={open} />;
  }
  const tables = { ...props, pickedTeamKey: null, onOpenTeam: open };
  return (
    <div className="space-y-3" data-testid="card-league-rankings">
      <LinkBar label="League view" items={viewLinks(board, boardHref)} testId="league-view-bar" />
      {board.view === "standings" ? <Standings {...tables} /> : <Categories {...tables} />}
      {pickedTeam !== null && (
        <TeamPopover
          table={table}
          leagueKey={leagueKey}
          teamKey={pickedTeam}
          periodLabel={periodLabel}
          onClose={() => setPickedTeam(null)}
          returnFocus={() => opener.current?.focus()}
          onPickLeague={onPickLeague}
        />
      )}
    </div>
  );
}
