import { useMemo } from "react";
import type { TeamDayResponse } from "@shared/api/daily-stats";
import { nbaDateOf, type TeamTable } from "@shared/domain";
import { useDraft, usePlayerStats, useTeamDay, useTransactions } from "@/api/daily-stats-hooks";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorScreen } from "@/features/league/ErrorScreen";
import { useNow } from "@/features/league/useNow";
import { cn } from "@/lib/utils";
import { teamCells } from "./league-board-model";
import { DatasetState } from "./DatasetState";
import { rankText, TONE_CLASS } from "./rank-tone";
import { rosterLines, type RosterLine } from "./team-roster-model";

interface TeamPopoverProps {
  table: TeamTable;
  leagueKey: string;
  teamKey: string;
  /** Yahoo's season record as W–L–T, or blank while it loads. */
  record: string;
  periodLabel: string;
  onClose: () => void;
  /** Puts focus back where the popover was opened from. */
  returnFocus: () => void;
  onPickLeague: () => void;
}

function RankGrid({ table, teamKey }: { table: TeamTable; teamKey: string }) {
  return (
    <ul className="grid grid-cols-3 gap-1.5" aria-label="Category ranks and totals">
      {teamCells(table, teamKey).map((cell) => (
        <li
          key={cell.key}
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

function PlayerRow({ line }: { line: RosterLine }) {
  const meta = [line.nbaTeam, line.acquired].filter((part) => part !== null).join(" · ");
  return (
    <li className="flex items-start justify-between gap-3 py-2" data-testid="popover-player">
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
    </li>
  );
}

/** The roster joined with season averages (D4), moves (D7) and the draft (D8); each loads on its own. */
function RosterList({
  leagueKey,
  roster,
  onPickLeague,
}: {
  leagueKey: string;
  roster: TeamDayResponse;
  onPickLeague: () => void;
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
      <ul className="divide-y divide-border" aria-label="Roster">
        {lines.map((line) => (
          <PlayerRow key={line.playerKey} line={line} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Season per-game averages.</p>
    </>
  );
}

function Roster({
  leagueKey,
  teamKey,
  onPickLeague,
}: Pick<TeamPopoverProps, "leagueKey" | "teamKey" | "onPickLeague">) {
  const today = nbaDateOf(useNow());
  const roster = useTeamDay(leagueKey, teamKey, today);
  return (
    <DatasetState query={roster} onPickLeague={onPickLeague}>
      {(data) => <RosterList leagueKey={leagueKey} roster={data} onPickLeague={onPickLeague} />}
    </DatasetState>
  );
}

/** One team's nine ranks and totals for the period, and its roster today. */
export function TeamPopover({
  table,
  leagueKey,
  teamKey,
  record,
  periodLabel,
  onClose,
  returnFocus,
  onPickLeague,
}: TeamPopoverProps) {
  const name = table.teams.find((team) => team.teamKey === teamKey)?.teamName ?? "Team";
  const subtitle = [record, `ranks for ${periodLabel.toLowerCase()}`]
    .filter((part) => part !== "")
    .join(" · ");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="team-popover"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <div className="pr-10">
          <DialogTitle className="text-lg font-bold">{name}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {subtitle}
          </DialogDescription>
        </div>
        <RankGrid table={table} teamKey={teamKey} />
        <Roster leagueKey={leagueKey} teamKey={teamKey} onPickLeague={onPickLeague} />
      </DialogContent>
    </Dialog>
  );
}
