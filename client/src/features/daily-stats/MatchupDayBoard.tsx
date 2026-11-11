import { useState } from "react";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import {
  CATEGORIES,
  closestLostCategory,
  compareTotals,
  opponentOf,
  type CategoryKey,
  type TeamTable,
} from "@shared/domain";
import { useLeagueScope } from "@/api/hooks";
import { useGameLogs, usePlayerStats, useTeamDay } from "@/api/daily-stats-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/features/league/categories";
import { DatasetState } from "./DatasetState";
import { FreshnessLine } from "./FreshnessLine";
import { MatchupHeader } from "./MatchupHeader";
import { playerCards } from "./matchup-board";
import { PlayerColumns, PlayerColumnView } from "./PlayerColumns";
import { TotalsGrid } from "./TotalsGrid";

interface MatchupDayBoardProps {
  leagueKey: string;
  teamKey: string;
  /** The US Eastern date the player columns show. */
  date: string;
  isToday: boolean;
  /** How the date reads on screen, for example "Today" or "Wed, Nov 11". */
  dateLabel: string;
  now: number;
  onPickLeague: () => void;
  /** Opens the shared player detail. */
  onOpenPlayer: (player: DailyPlayer) => void;
}

/** The opponent shown: the one the user picked, else Yahoo's, else the first other team on a bye. */
function shownOpponent(table: TeamTable | undefined, teamKey: string, picked: string | null) {
  if (!table) {
    return { opponentKey: picked, realOpponentKey: null };
  }
  const realOpponentKey = opponentOf(table, teamKey);
  const fallback = table.teams.find((team) => team.teamKey !== teamKey)?.teamKey ?? null;
  return { opponentKey: picked ?? realOpponentKey ?? fallback, realOpponentKey };
}

/** Every player on either roster, for one game-log and one season-stats request. */
function playerKeysOf(...days: ReturnType<typeof useTeamDay>[]): string[] {
  return days.flatMap((day) => day.data?.players.map(({ player }) => player.playerKey) ?? []);
}

/**
 * Matchup on one day: the week's score and totals grid against the chosen
 * opponent, then both rosters' cards for the date in the selected category.
 * Each dataset loads and fails on its own.
 */
/** The board's datasets and the opponent and category on show. */
function useMatchupDay(leagueKey: string, teamKey: string, date: string) {
  const [pickedOpponent, setPickedOpponent] = useState<string | null>(null);
  const [pickedCategory, setPickedCategory] = useState<CategoryKey | null>(null);
  const table = useLeagueScope(leagueKey, "current");
  const { opponentKey, realOpponentKey } = shownOpponent(table.data, teamKey, pickedOpponent);
  const myDay = useTeamDay(leagueKey, teamKey, date);
  const theirDay = useTeamDay(leagueKey, opponentKey, date);
  const players = playerKeysOf(myDay, theirDay);
  const logs = useGameLogs(leagueKey, players);
  const season = usePlayerStats(leagueKey, "season", players);
  const me = table.data?.teams.find((team) => team.teamKey === teamKey);
  const opponent = table.data?.teams.find((team) => team.teamKey === opponentKey);
  const comparison = me && opponent ? compareTotals(me.totals, opponent.totals) : null;
  return {
    table,
    myDay,
    theirDay,
    me,
    opponent,
    comparison,
    realOpponentKey,
    category: pickedCategory ?? (comparison ? closestLostCategory(comparison) : CATEGORIES[0]),
    myCards: myDay.data ? playerCards(myDay.data, logs.data, season.data) : [],
    theirCards: theirDay.data ? playerCards(theirDay.data, logs.data, season.data) : [],
    queries: [table, myDay, theirDay, logs, season],
    pickCategory: setPickedCategory,
    pickOpponent: (key: string) => {
      setPickedOpponent(key);
      setPickedCategory(null);
    },
  };
}

type MatchupDay = ReturnType<typeof useMatchupDay>;

/** The week so far: score, games left and opponent picker, then the totals grid. */
function WeekSummary({
  board,
  teamKey,
  onPickLeague,
}: {
  board: MatchupDay;
  teamKey: string;
  onPickLeague: () => void;
}) {
  const { me, opponent, comparison } = board;
  return (
    <DatasetState query={board.table} onPickLeague={onPickLeague}>
      {(data) =>
        me && opponent && comparison ? (
          <>
            <MatchupHeader
              me={me}
              opponent={opponent}
              others={data.teams.filter((team) => team.teamKey !== teamKey)}
              realOpponentKey={board.realOpponentKey}
              score={comparison.score}
              onPickOpponent={board.pickOpponent}
            />
            <h2 className="text-sm font-semibold">Week to date</h2>
            <TotalsGrid
              mine={{ label: me.teamName, totals: me.totals }}
              theirs={{ label: opponent.teamName, totals: opponent.totals }}
              comparison={comparison}
              selected={board.category}
              onSelect={board.pickCategory}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            This league has no other team to compare with.
          </p>
        )
      }
    </DatasetState>
  );
}

/**
 * Matchup on one day: the week's score and totals grid against the chosen
 * opponent, then both rosters' cards for the date in the selected category.
 * Each dataset loads and fails on its own.
 */
export function MatchupDayBoard(props: MatchupDayBoardProps) {
  const { leagueKey, teamKey, date, isToday, now, onPickLeague, onOpenPlayer } = props;
  const board = useMatchupDay(leagueKey, teamKey, date);
  const { me, opponent, category } = board;
  return (
    <div className="space-y-4">
      <FreshnessLine
        sources={board.queries}
        now={now}
        games={[...board.myCards, ...board.theirCards].map((card) => card.game)}
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <WeekSummary board={board} teamKey={teamKey} onPickLeague={onPickLeague} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base" data-testid="columns-title">
            {CATEGORY_LABELS[category]} · {props.dateLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerColumns>
            <DatasetState query={board.myDay} onPickLeague={onPickLeague}>
              {(mine) => (
                <PlayerColumnView
                  category={category}
                  isToday={isToday}
                  onOpenPlayer={onOpenPlayer}
                  column={{
                    teamKey: mine.teamKey,
                    label: me?.teamName ?? "Your team",
                    rows: board.myCards,
                  }}
                />
              )}
            </DatasetState>
            <DatasetState query={board.theirDay} onPickLeague={onPickLeague}>
              {(theirs) => (
                <PlayerColumnView
                  category={category}
                  isToday={isToday}
                  onOpenPlayer={onOpenPlayer}
                  column={{
                    teamKey: theirs.teamKey,
                    label: opponent?.teamName ?? "Opponent",
                    rows: board.theirCards,
                  }}
                />
              )}
            </DatasetState>
          </PlayerColumns>
        </CardContent>
      </Card>
    </div>
  );
}
