import { useState, type ReactNode } from "react";
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
import { CATEGORY_LABELS } from "@/features/league/categories";
import { DatasetState } from "./DatasetState";
import { FreshnessLine } from "./FreshnessLine";
import { orderHint, shownOpponent } from "./matchup-board";
import { BoardCard, MatchupTop } from "./MatchupTop";
import { PlayerColumns } from "./PlayerColumns";
import { ScoreCard, ScoreCardLoading } from "./ScoreCard";
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
  /** The Yesterday / Today / Week bar, which sticks with the score card. */
  dayBar: ReactNode;
  /** The week picker, under the sticky block. */
  weekPicker: ReactNode;
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

/** The score card from counted totals, its own skeleton while the week's table loads. */
function ScoreSlot({
  board,
  teamKey,
  onPickLeague,
}: {
  board: MatchupWeek;
  teamKey: string;
  onPickLeague: () => void;
}) {
  return (
    <DatasetState query={board.table} onPickLeague={onPickLeague} loading={<ScoreCardLoading />}>
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
          <ScoreCard
            me={me}
            opponent={opponent}
            others={data.teams.filter((team) => team.teamKey !== teamKey)}
            realOpponentKey={board.realOpponentKey}
            score={board.comparison?.score ?? EMPTY_SCORE}
            onPickOpponent={board.pickOpponent}
          />
        );
      }}
    </DatasetState>
  );
}

/** Both teams' counted totals as the grid, once both teams' days have loaded. */
function CountedGrid({ board, opponentName }: { board: MatchupWeek; opponentName: string }) {
  if (!board.mine || !board.theirs || !board.comparison) {
    return null;
  }
  return (
    <BoardCard label="Team totals" title="Counted totals" hint="Tap a category to compare below">
      <TotalsGrid
        mine={{ label: "You", totals: board.mine.totals }}
        theirs={{ label: opponentName, totals: board.theirs.totals }}
        comparison={board.comparison}
        selected={board.category}
        onSelect={board.pickCategory}
      />
    </BoardCard>
  );
}

/** Each team's players' weeks side by side in the selected category. */
function SideBySide({
  board,
  names,
  props,
}: {
  board: MatchupWeek;
  names: ReadonlyMap<string, string>;
  props: MatchupWeekBoardProps;
}) {
  const { teamKey, onPickLeague } = props;
  return (
    <BoardCard
      label="Players side by side"
      title={`${CATEGORY_LABELS[board.category]} · Week ${props.week.week}`}
      titleTestId="columns-title"
      hint={orderHint(board.category)}
    >
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
      <p className="mt-2 text-[11px] leading-[1.4] text-[#4B5563] dark:text-muted-foreground">
        Each side is sorted on its own, so players aren&apos;t paired. A week total only includes
        games that counted: on the roster, in a starting slot.
      </p>
    </BoardCard>
  );
}

/**
 * Matchup over one scoring week: the sticky score card and day bar, the week
 * picker, the score and grid from counted totals only (starting-slot days on
 * the roster), then each team's players' weeks side by side. Each team's days
 * load and fail on their own (its earlier days together, today alone), and a
 * failed request shows its error above the days that loaded.
 */
export function MatchupWeekBoard(props: MatchupWeekBoardProps) {
  const { teamKey, now, onPickLeague, isCurrentWeek, dayBar, weekPicker } = props;
  const board = useMatchupWeek(props);
  const names = new Map(board.table.data?.teams.map((team) => [team.teamKey, team.teamName]));
  return (
    <div className="space-y-5">
      <FreshnessLine
        sources={[board.table, board.myDays, board.theirDays]}
        now={now}
        games={isCurrentWeek ? CURRENT_WEEK_GAMES : PAST_WEEK_GAMES}
      />
      <MatchupTop>
        <ScoreSlot board={board} teamKey={teamKey} onPickLeague={onPickLeague} />
        {dayBar}
      </MatchupTop>
      {weekPicker}
      <CountedGrid board={board} opponentName={names.get(board.opponentKey ?? "") ?? "Opponent"} />
      <SideBySide board={board} names={names} props={props} />
    </div>
  );
}
