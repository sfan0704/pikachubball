/**
 * Puts the Matchup board's datasets together for the screen: each roster
 * player with their line, game and season average, and the text each part
 * shows. The fantasy maths lives in shared/domain; this only joins and formats.
 */
import type {
  GameLogsResponse,
  PlayerStatsResponse,
  TeamDayResponse,
} from "@shared/api/daily-stats";
import type { DailyPlayer, NbaGame } from "@shared/api/daily-stats-values";
import {
  CATEGORY_DIRECTIONS,
  isShootingCategory,
  lineWithGame,
  opponentOf,
  perGameAverages,
  type CategoryEntry,
  type CategoryKey,
  type CategoryValues,
  type GameState,
  type StatLine,
  type TeamTable,
} from "@shared/domain";

/** One player card: who, where they sat, their line, and what is known about their game and average. */
export interface PlayerCardRow {
  readonly player: DailyPlayer;
  readonly slot: string;
  readonly isStartingSlot: boolean;
  readonly line: StatLine;
  /** The player's game that date; null when there is none, undefined while game logs load or failed. */
  readonly game: NbaGame | null | undefined;
  /** Per-game season averages; null when unknown (still loading, failed, or no games played). */
  readonly average: CategoryValues | null;
}

function gameOn(logs: GameLogsResponse | undefined, playerKey: string, date: string) {
  if (!logs) {
    return undefined;
  }
  const log = logs.players.find((entry) => entry.playerKey === playerKey);
  return log ? (log.games.find((game) => game.date === date) ?? null) : undefined;
}

function averageOf(season: PlayerStatsResponse | undefined, playerKey: string) {
  const totals = season?.players.find((entry) => entry.playerKey === playerKey);
  if (!totals || totals.gamesPlayed === 0) {
    return null;
  }
  return perGameAverages(totals);
}

/**
 * A team's roster on a date joined with its game logs and season averages, in
 * roster order. A no-game line whose game is still to come reads as not yet played.
 */
export function playerCards(
  day: TeamDayResponse,
  logs: GameLogsResponse | undefined,
  season: PlayerStatsResponse | undefined
): PlayerCardRow[] {
  return day.players.map(({ player, slot, isStartingSlot, line }) => {
    const game = gameOn(logs, player.playerKey, day.date);
    return {
      player,
      slot,
      isStartingSlot,
      line: lineWithGame(line, game?.state),
      game,
      average: averageOf(season, player.playerKey),
    };
  });
}

/** The opponent shown: the one the user picked, else Yahoo's, else the first other team on a bye. */
export function shownOpponent(
  table: TeamTable | undefined,
  teamKey: string,
  picked: string | null
) {
  if (!table) {
    return { opponentKey: picked, realOpponentKey: null };
  }
  const realOpponentKey = opponentOf(table, teamKey);
  const fallback = table.teams.find((team) => team.teamKey !== teamKey)?.teamKey ?? null;
  return { opponentKey: picked ?? realOpponentKey ?? fallback, realOpponentKey };
}

/** "A. Knoll": a player's first initial and the rest of the name, so two columns fit a phone. */
export function shortName(name: string): string {
  const space = name.indexOf(" ");
  return space < 1 ? name : `${name[0]}. ${name.slice(space + 1)}`;
}

/** ".482": a percentage as box scores print it; "–" when nothing was attempted. */
export function percentText(value: number | null): string {
  return value === null ? "–" : value.toFixed(3).replace(/^0/, "");
}

/** Whether the player is out today by Yahoo's designation; never said of a past date. */
export function isOutToday(player: DailyPlayer, isToday: boolean): boolean {
  return isToday && player.injuryToday?.designation === "O";
}

/**
 * The card's main value: the percentage or count when measured, "–" before
 * the game, "n/a" when Yahoo has no data, "No game", and "Out" or "DNP" for a
 * player who didn't play. A measured zero always shows as 0.
 */
export function entryText(entry: CategoryEntry, out: boolean): string {
  if (entry.kind === "value") {
    if (entry.shots) {
      return entry.value === null ? "0/0" : percentText(entry.value);
    }
    return String(entry.value);
  }
  if (out) {
    return "Out";
  }
  const MISSING: Record<CategoryEntry["kind"], string> = {
    value: "",
    notYetPlayed: "–",
    unavailable: "n/a",
    noGame: "No game",
    didNotPlay: "DNP",
  };
  return MISSING[entry.kind];
}

/** The line under the value: makes/attempts for shooting, and the season average. */
export function averageText(
  key: CategoryKey,
  entry: CategoryEntry,
  average: CategoryValues | null
): string {
  const value = average?.[key] ?? null;
  const avg =
    value === null
      ? "avg –"
      : `avg ${isShootingCategory(key) ? percentText(value) : value.toFixed(1)}`;
  if (entry.kind === "value" && entry.shots) {
    return `${entry.shots.makes}/${entry.shots.attempts} · ${avg}`;
  }
  return avg;
}

const TIP_OFF = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

function periodName(period: number): string {
  return period <= 4 ? `Q${period}` : period === 5 ? "OT" : `${period - 4}OT`;
}

/** A game's state as the card shows it: tip-off in US Eastern time, quarter and clock, or the final score. */
export function gameStateText(state: GameState): string {
  switch (state.kind) {
    case "scheduled":
      return `${TIP_OFF.format(new Date(state.tipOff))} ET`;
    case "live":
      return state.progress.kind === "clock"
        ? `${periodName(state.progress.period)} ${state.progress.clock}`
        : state.progress.text;
    case "final":
      return `${state.result} ${state.ownScore}–${state.opponentScore}`;
    case "noGame":
      return "No game";
  }
}

/** The slot and the game under a player's name; no game, or a game still unknown, leaves just the slot. */
export function cardMeta(row: PlayerCardRow): string {
  return row.game ? `${row.slot} · ${gameStateText(row.game.state)}` : row.slot;
}

/** How each column is sorted for a category, as the side-by-side card's hint says it. */
export function orderHint(key: CategoryKey): string {
  if (isShootingCategory(key)) {
    return "most attempts first";
  }
  return CATEGORY_DIRECTIONS[key] === "lower" ? "fewest first" : "most first";
}
