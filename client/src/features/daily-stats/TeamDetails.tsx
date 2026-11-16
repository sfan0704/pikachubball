import { useMemo, type ReactNode } from "react";
import type { TeamDayResponse } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { nbaDateOf, type TeamTable } from "@shared/domain";
import { useDraft, usePlayerStats, useTeamDay, useTransactions } from "@/api/daily-stats-hooks";
import { ErrorScreen } from "@/features/league/ErrorScreen";
import { useNow } from "@/features/league/useNow";
import { cn } from "@/lib/utils";
import { teamCells } from "./league-board-model";
import { DatasetState } from "./DatasetState";
import { DetailsDescription, DetailsTitle } from "./DetailsPanel";
import { rankText, TONE_CLASS } from "./rank-tone";
import { CategoryAllPlay, TeamStanding } from "./TeamStanding";
import { rosterLines, type RosterLine } from "./team-roster-model";
import { useLeagueAllPlay } from "./useLeagueAllPlay";

interface TeamDetailsProps {
  table: TeamTable;
  leagueKey: string;
  teamKey: string;
  periodLabel: string;
  /** Whether the page already shows all-play's failure, as the Standings beside a panel do. */
  allPlayErrorShown: boolean;
  onPickLeague: () => void;
}

function RankGrid({ table, teamKey }: { table: TeamTable; teamKey: string }) {
  // Three to a row in a sheet; on the page as many as fit with their totals readable.
  return (
    <ul
      className="grid grid-cols-3 gap-1.5 md:grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))]"
      aria-label="Category ranks and totals"
    >
      {teamCells(table, teamKey).map((cell) => (
        <li
          key={cell.statId}
          className={cn("flex flex-col items-center rounded-[10px] py-1.5", TONE_CLASS[cell.tone])}
        >
          <span className="text-xs">{cell.label}</span>
          <span className="text-lg font-extrabold leading-tight">
            <span className="sr-only">rank </span>
            {rankText(cell.rank)}
          </span>
          <span className="text-xs tabular-nums">{cell.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Opens a roster player's details; without it the roster is a plain list, as in the phone sheet. */
type OpenPlayer = (player: DailyPlayer) => void;

function PlayerLine({ line }: { line: RosterLine }) {
  const meta = [line.nbaTeam, line.acquired].filter((part) => part !== null).join(" · ");
  return (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">
          {line.name}
          {line.injury && (
            <span className="ml-1.5 rounded-[6px] bg-red-50 px-1 text-xs font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
              {line.injury}
            </span>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">{meta}</span>
      </span>
      {line.averages && (
        <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {line.averages}
        </span>
      )}
    </>
  );
}

const LINE_CLASS = "flex items-start justify-between gap-3 py-2";

function PlayerRow({ line, onOpen }: { line: RosterLine; onOpen: (() => void) | null }) {
  if (onOpen === null) {
    return (
      <li className={LINE_CLASS} data-testid="popover-player">
        <PlayerLine line={line} />
      </li>
    );
  }
  return (
    <li data-testid="popover-player">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          LINE_CLASS,
          "w-full rounded-[6px] text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <PlayerLine line={line} />
      </button>
    </li>
  );
}

/** The roster joined with season averages (D4), moves (D7) and the draft (D8); each loads on its own. */
function RosterList({
  leagueKey,
  roster,
  onPickLeague,
  onOpenPlayer,
}: {
  leagueKey: string;
  roster: TeamDayResponse;
  onPickLeague: () => void;
  onOpenPlayer: OpenPlayer | undefined;
}) {
  const keys = useMemo(() => roster.players.map(({ player }) => player.playerKey), [roster]);
  const seasonStats = usePlayerStats(leagueKey, "season", keys);
  const transactions = useTransactions(leagueKey, roster.teamKey);
  const draft = useDraft(leagueKey);
  const failed = [seasonStats, transactions, draft].find((query) => query.error);
  const lines = rosterLines({
    roster,
    seasonStats: seasonStats.data,
    transactions: transactions.data,
    draft: draft.data,
  });
  const opener = (index: number) => {
    const player = roster.players[index]?.player;
    return onOpenPlayer && player ? () => onOpenPlayer(player) : null;
  };
  return (
    <>
      {failed && (
        <ErrorScreen
          error={failed.error}
          onRetry={() => void failed.refetch()}
          onPickLeague={onPickLeague}
          inline
        />
      )}
      {/* Three columns only where the roster has a card of its own across the page. */}
      <ul
        className="divide-y divide-border lg:grid lg:grid-cols-3 lg:gap-x-8 lg:divide-y-0 lg:[&>li]:border-t lg:[&>li]:border-border"
        aria-label="Roster"
      >
        {lines.map((line, index) => (
          <PlayerRow key={line.playerKey} line={line} onOpen={opener(index)} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Season per-game averages.</p>
    </>
  );
}

interface TeamRosterProps extends Pick<TeamDetailsProps, "leagueKey" | "teamKey" | "onPickLeague"> {
  /** Makes each player a button that opens their details. */
  onOpenPlayer?: OpenPlayer;
}

/** A team's roster today, under its details in a sheet or in a card of its own. */
export function TeamRoster({ leagueKey, teamKey, onPickLeague, onOpenPlayer }: TeamRosterProps) {
  const today = nbaDateOf(useNow());
  const roster = useTeamDay(leagueKey, teamKey, today);
  return (
    <DatasetState query={roster} onPickLeague={onPickLeague}>
      {(data) => (
        <RosterList
          leagueKey={leagueKey}
          roster={data}
          onPickLeague={onPickLeague}
          onOpenPlayer={onOpenPlayer}
        />
      )}
    </DatasetState>
  );
}

/** The team's name as the table has it. */
export function teamName(table: TeamTable, teamKey: string): string {
  return table.teams.find((team) => team.teamKey === teamKey)?.teamName ?? "Team";
}

/**
 * One team for the period, in a dialog or a panel: its standing, all-play and
 * luck worked out, its rank and total in each of the league's categories, and
 * its all-play by category on longer periods. The roster follows as children
 * in a sheet; on a wide screen it has a card of its own.
 */
export function TeamDetails({
  table,
  leagueKey,
  teamKey,
  periodLabel,
  allPlayErrorShown,
  onPickLeague,
  children,
}: TeamDetailsProps & { children?: ReactNode }) {
  const allPlay = useLeagueAllPlay(table, leagueKey);
  return (
    <div className="flex flex-col gap-3">
      {/* Right padding keeps the name clear of a dialog's close button. */}
      <div className="pr-10">
        <DetailsTitle className="text-lg font-bold">{teamName(table, teamKey)}</DetailsTitle>
        <DetailsDescription className="text-sm text-muted-foreground">
          {periodLabel}
        </DetailsDescription>
      </div>
      <TeamStanding
        table={table}
        teamKey={teamKey}
        allPlay={allPlay}
        allPlayErrorShown={allPlayErrorShown}
        onPickLeague={onPickLeague}
      />
      <RankGrid table={table} teamKey={teamKey} />
      <CategoryAllPlay table={table} teamKey={teamKey} allPlay={allPlay} />
      {children}
    </div>
  );
}
