import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { addDays, nbaDateOf } from "@shared/domain";
import { useGameLogs, usePlayerStats, useWeeks } from "@/api/daily-stats-hooks";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { InjuryTag } from "./InjuryTag";
import {
  DETAIL_COLUMN_LABELS,
  DETAIL_COLUMNS,
  columnStatus,
  detailRows,
  formatGameDate,
  gameStateText,
  lineOnDate,
  minutesText,
  opponentText,
  recentAndUpcoming,
  weekLine,
  weekOf,
  type LoggedGame,
} from "./player-detail-model";

interface PlayerDetailSheetProps {
  leagueKey: string;
  /** The player to show; null keeps the sheet closed. */
  player: DailyPlayer | null;
  /** The date the opening screen shows; the injury tag appears only when it is today. */
  viewDate: string;
  onClose: () => void;
  onPickLeague: () => void;
}

/**
 * The player detail that Matchup and Players both open: the nine categories for
 * today, yesterday, the week and the season average, then recent and upcoming
 * games. Works the same for rostered and available players.
 */
export function PlayerDetailSheet({
  leagueKey,
  player,
  viewDate,
  onClose,
  onPickLeague,
}: PlayerDetailSheetProps) {
  return (
    <Sheet open={player !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {player !== null && (
        <SheetContent data-testid="player-detail">
          <PlayerDetail
            leagueKey={leagueKey}
            player={player}
            viewDate={viewDate}
            onPickLeague={onPickLeague}
          />
        </SheetContent>
      )}
    </Sheet>
  );
}

function PlayerDetail({
  leagueKey,
  player,
  viewDate,
  onPickLeague,
}: Omit<PlayerDetailSheetProps, "player" | "onClose"> & { player: DailyPlayer }) {
  const today = nbaDateOf(useNow());
  const keys = [player.playerKey];
  const logs = useGameLogs(leagueKey, keys);
  const season = usePlayerStats(leagueKey, "season", keys);
  const weeks = useWeeks(leagueKey);
  return (
    <div className="space-y-5">
      <PlayerHeader player={player} showInjury={viewDate === today} />
      <DatasetState query={logs} onPickLeague={onPickLeague}>
        {(logData) => {
          const log = logData.players.find((entry) => entry.playerKey === player.playerKey);
          if (log === undefined) {
            return <p className="text-sm text-muted-foreground">Game log unavailable.</p>;
          }
          const games = log.games;
          return (
            <>
              <DatasetState query={season} onPickLeague={onPickLeague}>
                {(seasonData) => (
                  <DatasetState query={weeks} onPickLeague={onPickLeague}>
                    {(weekData) => (
                      <CategoryTable
                        games={games}
                        today={today}
                        week={weekOf(weekData.weeks, today)}
                        season={
                          seasonData.players.find(
                            (entry) => entry.playerKey === player.playerKey
                          ) ?? null
                        }
                      />
                    )}
                  </DatasetState>
                )}
              </DatasetState>
              <GameLists games={games} today={today} />
            </>
          );
        }}
      </DatasetState>
    </div>
  );
}

function PlayerHeader({ player, showInjury }: { player: DailyPlayer; showInjury: boolean }) {
  return (
    <header className="space-y-1 pr-10">
      <SheetTitle>{player.name}</SheetTitle>
      <SheetDescription>
        {player.positions.join(", ")} · {player.nbaTeam}
      </SheetDescription>
      {showInjury && player.injuryToday !== null && (
        <p className="flex items-center gap-2 text-sm" data-testid="player-detail-injury">
          <InjuryTag player={player} />
          <span>{player.injuryToday.reason}</span>
        </p>
      )}
    </header>
  );
}

interface CategoryTableProps {
  games: readonly LoggedGame[];
  today: string;
  week: { start: string; end: string } | null;
  season: Parameters<typeof detailRows>[0]["season"];
}

function CategoryTable({ games, today, week, season }: CategoryTableProps) {
  const yesterday = addDays(today, -1);
  const rows = detailRows({
    lines: {
      today: lineOnDate(games, today),
      yesterday: lineOnDate(games, yesterday),
      week: weekLine(games, week),
    },
    season,
  });
  const status = columnStatus(games, today, week, season);
  return (
    <table className="w-full table-fixed text-sm" data-testid="player-detail-stats">
      <thead>
        <tr>
          <th scope="col" className="w-12 text-left font-normal text-muted-foreground">
            <span className="sr-only">Category</span>
          </th>
          {DETAIL_COLUMNS.map((column) => (
            <th key={column} scope="col" className="pb-2 text-right font-medium">
              <span className="block">{DETAIL_COLUMN_LABELS[column]}</span>
              <span
                className="block text-xs font-normal text-muted-foreground"
                data-testid={`player-detail-status-${column}`}
              >
                {status[column]}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t">
            <th scope="row" className="py-1.5 text-left font-medium">
              {row.label}
            </th>
            {DETAIL_COLUMNS.map((column) => (
              <td key={column} className="py-1.5 text-right tabular-nums">
                {row.cells[column].text}
                {row.cells[column].shots !== null && (
                  <span className="block text-xs text-muted-foreground">
                    {row.cells[column].shots}
                  </span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GameList({ title, games }: { title: string; games: readonly LoggedGame[] }) {
  return (
    <section aria-label={title} className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="divide-y text-sm">
          {games.map((game) => (
            <li key={game.gameId} className="flex justify-between gap-2 py-1.5">
              <span className="w-24 shrink-0">{formatGameDate(game.date)}</span>
              <span className="w-16 shrink-0">{opponentText(game)}</span>
              <span className="flex-1 text-right tabular-nums">{gameStateText(game.state)}</span>
              <span className="w-14 shrink-0 text-right text-muted-foreground">
                {minutesText(game)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GameLists({ games, today }: { games: readonly LoggedGame[]; today: string }) {
  const { recent, upcoming } = recentAndUpcoming(games, today);
  return (
    <div className="space-y-4">
      <GameList title="Recent games" games={recent} />
      <GameList title="Today and next" games={upcoming} />
    </div>
  );
}
