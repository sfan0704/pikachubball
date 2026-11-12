import { useState } from "react";
import type { LeagueScope } from "@shared/api/league-scope";
import {
  CATEGORIES,
  closestLostCategory,
  compareTotals,
  elapsedDates,
  type CategoryKey,
  type Score,
} from "@shared/domain";
import { useLeagueScope } from "@/api/hooks";
import { useTeamDays } from "@/api/daily-stats-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/features/league/categories";
import { DatasetState } from "./DatasetState";
import { FreshnessLine } from "./FreshnessLine";
import { MatchupHeader } from "./MatchupHeader";
import { shownOpponent } from "./matchup-board";
import { PlayerColumns } from "./PlayerColumns";
import { TotalsGrid } from "./TotalsGrid";
import { WeekColumnView } from "./WeekColumn";
import { teamWeek, type ScoringWeek } from "./week-board";

interface MatchupWeekBoardProps {
  leagueKey: string;
  teamKey: string;
  week: ScoringWeek;
  /** Whether the week holds today; only then does "out right now" use today's injuries. */
  isCurrentWeek: boolean;
  today: string;
  now: number;
  onPickLeague: () => void;
}

/** A finished week's games are all final; the current week's live state isn't read here. */
const PAST_WEEK_GAMES: readonly [] = [];
const CURRENT_WEEK_GAMES: readonly [undefined] = [undefined];

/** The board's datasets: the week's table for names and the opponent, and both teams' days. */
function useMatchupWeek(props: MatchupWeekBoardProps) {
  const { leagueKey, teamKey, week, isCurrentWeek, today } = props;
  const [pickedOpponent, setPickedOpponent] = useState<string | null>(null);
  const [pickedCategory, setPickedCategory] = useState<CategoryKey | null>(null);
  const scope: LeagueScope = isCurrentWeek ? "current" : week.week;
  const table = useLeagueScope(leagueKey, scope);
  const { opponentKey, realOpponentKey } = shownOpponent(table.data, teamKey, pickedOpponent);
  const dates = elapsedDates(week, today);
  const myDays = useTeamDays(leagueKey, teamKey, dates, today);
  const theirDays = useTeamDays(leagueKey, opponentKey, dates, today);
  const mine = myDays.data ? teamWeek(myDays.data, week, isCurrentWeek) : null;
  const theirs = theirDays.data ? teamWeek(theirDays.data, week, isCurrentWeek) : null;
  const comparison = mine && theirs ? compareTotals(mine.totals, theirs.totals) : null;
  return {
    table,
    myDays,
    theirDays,
    mine,
    theirs,
    comparison,
    opponentKey,
    realOpponentKey,
    category: pickedCategory ?? (comparison ? closestLostCategory(comparison) : CATEGORIES[0]),
    pickCategory: setPickedCategory,
    pickOpponent: (key: string) => {
      setPickedOpponent(key);
      setPickedCategory(null);
    },
  };
}

type MatchupWeek = ReturnType<typeof useMatchupWeek>;

/** The score before both teams' days have loaded: nothing known yet. */
const EMPTY_SCORE: Score = {
  wins: 0,
  losses: 0,
  ties: 0,
  unavailable: CATEGORIES.length,
  complete: false,
};

/** The week's counted score and grid, with the opponent picker. */
function WeekSummary({
  board,
  teamKey,
  onPickLeague,
}: {
  board: MatchupWeek;
  teamKey: string;
  onPickLeague: () => void;
}) {
  return (
    <DatasetState query={board.table} onPickLeague={onPickLeague}>
      {(data) => {
        const me = data.teams.find((team) => team.teamKey === teamKey);
        const opponent = data.teams.find((team) => team.teamKey === board.opponentKey);
        if (!me || !opponent) {
          return (
            <p className="text-sm text-muted-foreground" role="status">
              This league has no other team to compare with.
            </p>
          );
        }
        return (
          <>
            <MatchupHeader
              me={me}
              opponent={opponent}
              others={data.teams.filter((team) => team.teamKey !== teamKey)}
              realOpponentKey={board.realOpponentKey}
              score={board.comparison?.score ?? EMPTY_SCORE}
              onPickOpponent={board.pickOpponent}
            />
            <h2 className="text-sm font-semibold">Counted totals</h2>
            <CountedGrid
              board={board}
              labels={[me.teamName, opponent.teamName]}
              onPickLeague={onPickLeague}
            />
          </>
        );
      }}
    </DatasetState>
  );
}

/** Both teams' counted totals as the grid, once both teams' days have loaded. */
function CountedGrid({
  board,
  labels,
  onPickLeague,
}: {
  board: MatchupWeek;
  labels: readonly [string, string];
  onPickLeague: () => void;
}) {
  return (
    <DatasetState query={board.myDays} onPickLeague={onPickLeague}>
      {() => (
        <DatasetState query={board.theirDays} onPickLeague={onPickLeague}>
          {() =>
            board.mine && board.theirs && board.comparison ? (
              <TotalsGrid
                mine={{ label: labels[0], totals: board.mine.totals }}
                theirs={{ label: labels[1], totals: board.theirs.totals }}
                comparison={board.comparison}
                selected={board.category}
                onSelect={board.pickCategory}
              />
            ) : null
          }
        </DatasetState>
      )}
    </DatasetState>
  );
}

/**
 * Matchup over one scoring week: the score and grid from counted totals only
 * (starting-slot days on the roster), then each team's players' weeks side by
 * side. Each team's days load and fail on their own (its earlier days together,
 * today alone), and a failed request shows its error above the days that loaded.
 */
export function MatchupWeekBoard(props: MatchupWeekBoardProps) {
  const { teamKey, now, onPickLeague, isCurrentWeek } = props;
  const board = useMatchupWeek(props);
  const names = new Map(board.table.data?.teams.map((team) => [team.teamKey, team.teamName]));
  return (
    <div className="space-y-4">
      <FreshnessLine
        sources={[board.table, board.myDays, board.theirDays]}
        now={now}
        games={isCurrentWeek ? CURRENT_WEEK_GAMES : PAST_WEEK_GAMES}
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <WeekSummary board={board} teamKey={teamKey} onPickLeague={onPickLeague} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base" data-testid="columns-title">
            {CATEGORY_LABELS[board.category]} · Week {props.week.week}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerColumns>
            <DatasetState query={board.myDays} onPickLeague={onPickLeague}>
              {() =>
                board.mine && (
                  <WeekColumnView
                    category={board.category}
                    column={{
                      teamKey,
                      label: names.get(teamKey) ?? "Your team",
                      cards: board.mine.cards,
                    }}
                  />
                )
              }
            </DatasetState>
            <DatasetState query={board.theirDays} onPickLeague={onPickLeague}>
              {() =>
                board.theirs &&
                board.opponentKey && (
                  <WeekColumnView
                    category={board.category}
                    column={{
                      teamKey: board.opponentKey,
                      label: names.get(board.opponentKey) ?? "Opponent",
                      cards: board.theirs.cards,
                    }}
                  />
                )
              }
            </DatasetState>
          </PlayerColumns>
        </CardContent>
      </Card>
    </div>
  );
}
