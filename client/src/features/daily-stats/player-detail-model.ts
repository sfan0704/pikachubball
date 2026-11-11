import type { GameLogsResponse, PlayerStatsResponse, WeeksResponse } from "@shared/api/daily-stats";
import {
  addDays,
  appearance,
  CATEGORIES,
  missingLine,
  perGameAverages,
  sumLines,
  type CategoryKey,
  type GameState,
  type ShotValue,
  type StatLine,
} from "@shared/domain";
import { CATEGORY_LABELS, UNAVAILABLE } from "@/features/league/categories";

/** One game of the player's team, with the player's minutes and line. */
export type LoggedGame = GameLogsResponse["players"][number]["games"][number];

/** The sheet's four columns, left to right. */
export const DETAIL_COLUMNS = ["today", "yesterday", "week", "season"] as const;

export type DetailColumn = (typeof DETAIL_COLUMNS)[number];

/** Column headings: a fantasy player reads "Avg" as the season's per-game average. */
export const DETAIL_COLUMN_LABELS: Readonly<Record<DetailColumn, string>> = {
  today: "Today",
  yesterday: "Yest.",
  week: "Week",
  season: "Avg",
};

/** A value as shown, with makes/attempts under FG% and FT%. */
export interface DetailCell {
  readonly text: string;
  readonly shots: string | null;
}

/** One category across the four columns. */
export interface DetailRow {
  readonly key: CategoryKey;
  readonly label: string;
  readonly cells: Readonly<Record<DetailColumn, DetailCell>>;
}

/** What the table needs: the player's lines by column and their season totals. */
export interface DetailInputs {
  readonly lines: Readonly<Record<Exclude<DetailColumn, "season">, StatLine>>;
  readonly season: PlayerStatsResponse["players"][number] | null;
}

const SHOT_FIELD = { fgPct: "fg", ftPct: "ft" } as const;

function percentText(makes: number, attempts: number): string {
  return attempts === 0 ? UNAVAILABLE : `${((makes / attempts) * 100).toFixed(1)}%`;
}

function shotCell(value: ShotValue, perGame = 1): DetailCell {
  if (value.kind !== "value") {
    return { text: UNAVAILABLE, shots: null };
  }
  const { makes, attempts } = value.value;
  const digits = perGame === 1 ? 0 : 1;
  return {
    text: percentText(makes, attempts),
    shots: `${(makes / perGame).toFixed(digits)}/${(attempts / perGame).toFixed(digits)}`,
  };
}

function lineCell(line: StatLine, key: CategoryKey): DetailCell {
  if (key === "fgPct" || key === "ftPct") {
    return shotCell(line[SHOT_FIELD[key]]);
  }
  const value = line[key];
  return { text: value.kind === "value" ? String(value.value) : UNAVAILABLE, shots: null };
}

function seasonCell(season: DetailInputs["season"], key: CategoryKey): DetailCell {
  if (season === null || season.gamesPlayed === 0) {
    return { text: UNAVAILABLE, shots: null };
  }
  if (key === "fgPct" || key === "ftPct") {
    return shotCell(season.line[SHOT_FIELD[key]], season.gamesPlayed);
  }
  const value = perGameAverages(season)[key];
  return { text: value === null ? UNAVAILABLE : value.toFixed(1), shots: null };
}

/** The nine categories for today, yesterday, the week so far and the season's per-game average. */
export function detailRows({ lines, season }: DetailInputs): DetailRow[] {
  return CATEGORIES.map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    cells: {
      today: lineCell(lines.today, key),
      yesterday: lineCell(lines.yesterday, key),
      week: lineCell(lines.week, key),
      season: seasonCell(season, key),
    },
  }));
}

/** The player's line on a date: their game's line, or no game when the team didn't play. */
export function lineOnDate(games: readonly LoggedGame[], date: string): StatLine {
  return games.find((game) => game.date === date)?.line ?? missingLine("noGame");
}

/** The scoring week that holds `date`, or null outside the season. */
export function weekOf(weeks: WeeksResponse["weeks"], date: string) {
  return weeks.find(({ start, end }) => start <= date && date <= end) ?? null;
}

/** The player's lines added over the week's games; outside the season the week is unavailable. */
export function weekLine(
  games: readonly LoggedGame[],
  week: { start: string; end: string } | null
): StatLine {
  if (week === null) {
    return missingLine("unavailable");
  }
  return sumLines(
    games.filter(({ date }) => week.start <= date && date <= week.end).map(({ line }) => line)
  );
}

function tipOffText(tipOff: string): string {
  return new Date(tipOff).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** A game's state in a few characters: tip-off, quarter and clock, or result and score. */
export function gameStateText(state: GameState): string {
  switch (state.kind) {
    case "noGame":
      return "No game";
    case "scheduled":
      return tipOffText(state.tipOff);
    case "final":
      return `${state.result} ${state.ownScore}-${state.opponentScore}`;
    case "live":
      return state.progress.kind === "text"
        ? state.progress.text
        : `Q${state.progress.period} ${state.progress.clock}, ${state.progress.ownScore}-${state.progress.opponentScore}`;
  }
}

/** What the player's day was, above that day's column: the game, or that they sat it out. */
export function dayStatus(games: readonly LoggedGame[], date: string): string {
  const game = games.find((entry) => entry.date === date);
  if (game === undefined) {
    return "No game";
  }
  const played = appearance(game.line);
  if (played === "didNotPlay") {
    return "DNP";
  }
  return played === "unavailable" ? UNAVAILABLE : gameStateText(game.state);
}

/** The line under each column heading: the day's game or games played. */
export function columnStatus(
  games: readonly LoggedGame[],
  today: string,
  week: { start: string; end: string } | null,
  season: DetailInputs["season"]
): Record<DetailColumn, string> {
  const weekGames =
    week === null
      ? null
      : games.filter(
          (game) =>
            week.start <= game.date && game.date <= week.end && appearance(game.line) === "played"
        ).length;
  return {
    today: dayStatus(games, today),
    yesterday: dayStatus(games, addDays(today, -1)),
    week: weekGames === null ? UNAVAILABLE : `${weekGames} GP`,
    season: season === null ? UNAVAILABLE : `${season.gamesPlayed} GP`,
  };
}

/** Opponent as box scores write it: "vs NYK" at home, "@ NYK" away. */
export function opponentText(game: { opponent: string; isHome: boolean }): string {
  return `${game.isHome ? "vs" : "@"} ${game.opponent}`;
}

/** The player's minutes in a game, or why there are none. */
export function minutesText(game: LoggedGame): string {
  switch (game.minutes.kind) {
    case "value":
      return `${game.minutes.value} min`;
    case "didNotPlay":
      return "DNP";
    default:
      return "";
  }
}

/** How many games of the player's team the sheet lists before and from today. */
const RECENT_GAMES = 3;
const UPCOMING_GAMES = 4;

/** The player's last few games before today, newest first, and today's and the next few. */
export function recentAndUpcoming(
  games: readonly LoggedGame[],
  today: string
): { recent: LoggedGame[]; upcoming: LoggedGame[] } {
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  return {
    recent: sorted
      .filter((game) => game.date < today)
      .slice(-RECENT_GAMES)
      .reverse(),
    upcoming: sorted.filter((game) => game.date >= today).slice(0, UPCOMING_GAMES),
  };
}

/** Yahoo's page for the player, which carries the injury note. */
export function yahooPlayerUrl(playerKey: string): string {
  const id = playerKey.slice(playerKey.lastIndexOf(".") + 1);
  return `https://sports.yahoo.com/nba/players/${id}/`;
}

/** A US Eastern date as the viewer reads it, for example "Wed, Nov 11". */
export function formatGameDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
