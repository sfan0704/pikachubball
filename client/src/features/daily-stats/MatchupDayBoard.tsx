import { useState, type ReactNode } from "react";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { CATEGORIES, closestLostCategory, compareTotals, type CategoryKey } from "@shared/domain";
import { useLeagueScope } from "@/api/hooks";
import { useGameLogs, usePlayerStats, useTeamDay } from "@/api/daily-stats-hooks";
import { CATEGORY_LABELS } from "@/features/league/categories";
import { DatasetState } from "./DatasetState";
import { FreshnessLine } from "./FreshnessLine";
import { orderHint, playerCards, shownOpponent } from "./matchup-board";
import { BoardCard, MatchupTop } from "./MatchupTop";
import { PlayerColumns, PlayerColumnView } from "./PlayerColumns";
import { ScoreCard, ScoreCardLoading } from "./ScoreCard";
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
  /** The Yesterday / Today / Week bar, which sticks with the score card. */
  dayBar: ReactNode;
}

/** Every player on either roster, for one game-log and one season-stats request. */
function playerKeysOf(...days: ReturnType<typeof useTeamDay>[]): string[] {
  return days.flatMap((day) => day.data?.players.map(({ player }) => player.playerKey) ?? []);
}

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

/** The score card against the chosen opponent, its own skeleton while the week's table loads. */
function ScoreSlot({
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
    <DatasetState query={board.table} onPickLeague={onPickLeague} loading={<ScoreCardLoading />}>
      {(data) =>
        me && opponent && comparison ? (
          <ScoreCard
            me={me}
            opponent={opponent}
            others={data.teams.filter((team) => team.teamKey !== teamKey)}
            realOpponentKey={board.realOpponentKey}
            score={comparison.score}
            onPickOpponent={board.pickOpponent}
          />
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            This league has no other team to compare with.
          </p>
        )
      }
    </DatasetState>
  );
}

/** Both rosters' cards for the date, side by side, in the selected category. */
function SideBySide({ board, props }: { board: MatchupDay; props: MatchupDayBoardProps }) {
  const { isToday, onPickLeague, onOpenPlayer } = props;
  const { me, opponent, category } = board;
  return (
    <BoardCard
      label="Players side by side"
      title={`${CATEGORY_LABELS[category]} · ${props.dateLabel}`}
      titleTestId="columns-title"
      hint={orderHint(category)}
    >
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
      <p className="mt-2 text-[11px] leading-[1.4] text-[#4B5563] dark:text-muted-foreground">
        Each side is sorted on its own, so players aren&apos;t paired. Avg is the season per-game
        average. Green and red compare with it.
      </p>
    </BoardCard>
  );
}

/**
 * Matchup on one day: the sticky score card and day bar, the week's totals
 * grid against the chosen opponent, then both rosters' cards for the date in
 * the selected category. Each dataset loads and fails on its own.
 */
export function MatchupDayBoard(props: MatchupDayBoardProps) {
  const { leagueKey, teamKey, date, now, onPickLeague, dayBar } = props;
  const board = useMatchupDay(leagueKey, teamKey, date);
  const { me, opponent, comparison } = board;
  return (
    <div className="space-y-5">
      <FreshnessLine
        sources={board.queries}
        now={now}
        games={[...board.myCards, ...board.theirCards].map((card) => card.game)}
      />
      <MatchupTop>
        <ScoreSlot board={board} teamKey={teamKey} onPickLeague={onPickLeague} />
        {dayBar}
      </MatchupTop>
      {me && opponent && comparison && (
        <BoardCard label="Team totals" title="Week to date" hint="Tap a category to compare below">
          <TotalsGrid
            mine={{ label: "You", totals: me.totals }}
            theirs={{ label: opponent.teamName, totals: opponent.totals }}
            comparison={comparison}
            selected={board.category}
            onSelect={board.pickCategory}
          />
        </BoardCard>
      )}
      <SideBySide board={board} props={props} />
    </div>
  );
}
