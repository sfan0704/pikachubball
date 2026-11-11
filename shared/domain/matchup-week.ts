/**
 * The Matchup Week view: each player's week as it counted for the team. A
 * player's week holds only starting-slot days on the roster, so the players'
 * totals add up to the team's. Pure; the screens only format what these return.
 */
import { addDays } from "./nba-date";
import { countedGames, countedTotals, type PlayerDay } from "./daily-stats";
import { CATEGORY_DIRECTIONS, categoryValue } from "./fantasy-rules";
import { isShootingCategory } from "./matchup-day";
import { appearance } from "./stat-value";
import type { CategoryKey } from "./stats";
import type { TeamTotals } from "./team-table";

/** A scoring week's first and last date, as Yahoo bounds it. */
export interface WeekBounds {
  readonly start: string;
  readonly end: string;
}

/** The week's dates that have begun by `today`, in order; empty before the week starts. */
export function elapsedDates({ start, end }: WeekBounds, today: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end && date <= today; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** Where a player's week shows: with the team, set apart as out, or with the dropped players. */
export type WeekGroup = "roster" | "out" | "dropped";

/** One player's week for one team. */
export interface WeekPlayer {
  readonly playerKey: string;
  readonly group: WeekGroup;
  /** The first date on the roster when it came after the week's first date; null otherwise. */
  readonly addedOn: string | null;
  /** The last date on the roster when the player was gone by the last date shown; null otherwise. */
  readonly droppedAfter: string | null;
  /** Played games on the roster (including ones the player sat out), counted or not. */
  readonly games: number;
  /** Of those, the games in a starting slot. */
  readonly countedGames: number;
  /** Whether any counted game has a measured line; without one the player added nothing. */
  readonly contributed: boolean;
  /** The totals that counted for the team. */
  readonly totals: TeamTotals;
}

function playedGames(days: readonly PlayerDay[]): number {
  return days.filter((day) => {
    const kind = appearance(day.line);
    return kind === "played" || kind === "didNotPlay";
  }).length;
}

function groupOf(isDropped: boolean, isOutNow: boolean): WeekGroup {
  if (isDropped) {
    return "dropped";
  }
  return isOutNow ? "out" : "roster";
}

/**
 * Every player on the team's roster on any shown date, in the order they
 * first appear. `days` holds the team's player-days for the shown dates;
 * `outNow` names the players out injured right now, who are set apart.
 */
export function weekPlayers(
  days: readonly PlayerDay[],
  bounds: WeekBounds,
  outNow: ReadonlySet<string>
): WeekPlayer[] {
  const byPlayer = new Map<string, PlayerDay[]>();
  for (const day of days) {
    byPlayer.set(day.playerKey, [...(byPlayer.get(day.playerKey) ?? []), day]);
  }
  const lastShown = days.reduce((last, day) => (day.date > last ? day.date : last), bounds.start);
  return [...byPlayer].map(([playerKey, own]) => {
    const dates = own.map((day) => day.date).sort();
    const [first, last] = [dates[0], dates[dates.length - 1]];
    const counted = own.filter((day) => day.isStartingSlot);
    return {
      playerKey,
      group: groupOf(last < lastShown, outNow.has(playerKey)),
      addedOn: first > bounds.start ? first : null,
      droppedAfter: last < lastShown ? last : null,
      games: playedGames(own),
      countedGames: countedGames(own),
      contributed: counted.some((day) => appearance(day.line) === "played"),
      totals: countedTotals(own),
    };
  });
}

/**
 * How the player's games counted, when that needs saying: "Benched" when none
 * did, "1 of 2 G counted" when some did, otherwise null.
 */
export function countedGamesLabel(player: WeekPlayer): string | null {
  if (player.games === 0 || player.countedGames === player.games) {
    return null;
  }
  if (player.countedGames === 0) {
    return "Benched";
  }
  return `${player.countedGames} of ${player.games} G counted`;
}

/** The player's counted value in a category; null when nothing counted or it is unknown. */
export function weekValue(player: WeekPlayer, key: CategoryKey): number | null {
  return player.contributed ? categoryValue(player.totals, key) : null;
}

/** The number a column sorts on: attempts for shooting (volume decides the percentage), else the value. */
function sortValue(player: WeekPlayer, key: CategoryKey): number | null {
  if (!player.contributed) {
    return null;
  }
  if (isShootingCategory(key)) {
    return key === "fgPct" ? player.totals.fgAttempts : player.totals.ftAttempts;
  }
  return categoryValue(player.totals, key);
}

/**
 * One group of a Week column ordered for a category: players who added
 * something first, best first (fewest turnovers, most attempts for FG% and
 * FT%), then the rest. Equal players keep their roster order.
 */
export function orderWeekPlayers<T extends WeekPlayer>(
  players: readonly T[],
  key: CategoryKey
): T[] {
  const lowerIsBetter = CATEGORY_DIRECTIONS[key] === "lower";
  const keyed = players.map((player, index) => ({ player, index, value: sortValue(player, key) }));
  keyed.sort((a, b) => {
    if (a.value === null || b.value === null) {
      return (a.value === null ? 1 : 0) - (b.value === null ? 1 : 0) || a.index - b.index;
    }
    return (lowerIsBetter ? a.value - b.value : b.value - a.value) || a.index - b.index;
  });
  return keyed.map(({ player }) => player);
}
