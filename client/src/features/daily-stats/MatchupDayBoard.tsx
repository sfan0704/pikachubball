import { useState, type ReactNode } from "react";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import {
  closestLostCategory,
  compareCategories,
  orderForCategory,
  type LeagueCategory,
} from "@shared/domain";
import { useLeagueScope } from "@/api/hooks";
import { useGameLogs, usePlayerStats, useTeamDay } from "@/api/daily-stats-hooks";
import { categoryLabel } from "@/features/league/categories";
import { DatasetState } from "./DatasetState";
import { DetailsPanel } from "./DetailsPanel";
import { FreshnessLine } from "./FreshnessLine";
import {
  NO_CATEGORIES,
  orderHint,
  playerCards,
  shownCategory,
  shownOpponent,
  type PlayerCardRow,
} from "./matchup-board";
import { BoardCard, MatchupColumns, MatchupTop } from "./MatchupTop";
import { PlayerColumns, PlayerColumnView } from "./PlayerColumns";
import { PlayerDetails } from "./PlayerDetails";
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
  /** The player last opened, or null; the panel shows them while they are on either roster. */
  openPlayer: DailyPlayer | null;
  /** Whether the player details stay open in a panel beside the columns (lg) rather than a sheet. */
  showPanel: boolean;
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
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const table = useLeagueScope(leagueKey, "current");
  const { opponentKey, realOpponentKey } = shownOpponent(table.data, teamKey, pickedOpponent);
  const myDay = useTeamDay(leagueKey, teamKey, date);
  const theirDay = useTeamDay(leagueKey, opponentKey, date);
  const players = playerKeysOf(myDay, theirDay);
  const logs = useGameLogs(leagueKey, players);
  const season = usePlayerStats(leagueKey, "season", players);
  const categories = table.data?.settings.categories ?? NO_CATEGORIES;
  const me = table.data?.teams.find((team) => team.teamKey === teamKey);
  const opponent = table.data?.teams.find((team) => team.teamKey === opponentKey);
  const comparison =
    me && opponent
      ? compareCategories(categories, me.categoryValues, opponent.categoryValues)
      : null;
  return {
    table,
    myDay,
    theirDay,
    me,
    opponent,
    comparison,
    realOpponentKey,
    category: shownCategory(
      categories,
      pickedCategory,
      comparison && closestLostCategory(comparison)
    ),
    myCards: myDay.data ? playerCards(myDay.data, logs.data, season.data, categories) : [],
    theirCards: theirDay.data ? playerCards(theirDay.data, logs.data, season.data, categories) : [],
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
function SideBySide({
  board,
  category,
  pickedKey,
  props,
}: {
  board: MatchupDay;
  category: LeagueCategory | null;
  pickedKey: string | null;
  props: MatchupDayBoardProps;
}) {
  const { isToday, onPickLeague, onOpenPlayer } = props;
  const { me, opponent } = board;
  return (
    <BoardCard
      label="Players side by side"
      title={`${category ? categoryLabel(category) : "Players"} · ${props.dateLabel}`}
      titleTestId="columns-title"
      hint={category ? orderHint(category) : "roster order"}
    >
      <PlayerColumns>
        <DatasetState query={board.myDay} onPickLeague={onPickLeague}>
          {(mine) => (
            <PlayerColumnView
              category={category}
              isToday={isToday}
              onOpenPlayer={onOpenPlayer}
              pickedKey={pickedKey}
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
              pickedKey={pickedKey}
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
 * The player the panel shows: the one last opened while on either roster,
 * else the top counted player in the category (yours first), else anyone listed.
 */
function panelPlayer(
  board: MatchupDay,
  openPlayer: DailyPlayer | null,
  category: LeagueCategory | null
): DailyPlayer | null {
  const rows = [...board.myCards, ...board.theirCards];
  const opened = rows.find((row) => row.player.playerKey === openPlayer?.playerKey);
  const top = (cards: readonly PlayerCardRow[]) =>
    orderForCategory(cards, category).find((row) => row.isStartingSlot);
  return (opened ?? top(board.myCards) ?? top(board.theirCards) ?? rows.at(0))?.player ?? null;
}

/**
 * Matchup on one day: the sticky score card and day bar, the week's totals
 * grid against the chosen opponent, then both rosters' cards for the date in
 * the selected category. Each dataset loads and fails on its own.
 */
export function MatchupDayBoard(props: MatchupDayBoardProps) {
  const { leagueKey, teamKey, date, now, onPickLeague, dayBar, showPanel } = props;
  const board = useMatchupDay(leagueKey, teamKey, date);
  const { me, opponent, comparison } = board;
  const picked = showPanel ? panelPlayer(board, props.openPlayer, board.category) : null;
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
      <MatchupColumns
        players={
          <SideBySide
            board={board}
            category={board.category}
            pickedKey={picked?.playerKey ?? null}
            props={props}
          />
        }
      >
        {me && opponent && comparison && board.category && (
          <BoardCard
            label="Team totals"
            title="Week to date"
            hint="Tap a category to compare below"
          >
            <TotalsGrid
              mine={{ label: "You", values: me.categoryValues }}
              theirs={{ label: opponent.teamName, values: opponent.categoryValues }}
              comparison={comparison}
              selected={board.category.statId}
              onSelect={board.pickCategory}
            />
          </BoardCard>
        )}
        {picked && (
          <DetailsPanel testId="player-panel">
            <PlayerDetails
              leagueKey={leagueKey}
              player={picked}
              viewDate={date}
              onPickLeague={onPickLeague}
            />
          </DetailsPanel>
        )}
      </MatchupColumns>
    </div>
  );
}
