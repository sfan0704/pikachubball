import type { GameLogsResponse, PlayerStatsResponse, WeeksResponse } from "@shared/api/daily-stats";
import {
  addDays,
  appearance,
  categoryEntry,
  missingLine,
  perGameAverages,
  sumLines,
  type GameState,
  type LeagueCategory,
  type StatLine,
} from "@shared/domain";
import { categoryLabel, formatTotal, UNAVAILABLE } from "@/features/league/categories";

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

/** A value as shown, with a ratio's parts (makes/attempts) under it. */
export interface DetailCell {
  readonly text: string;
  readonly parts: string | null;
}

/** One category across the four columns. */
export interface DetailRow {
  /** The category's stat id. */
  readonly key: string;
  readonly label: string;
  readonly cells: Readonly<Record<DetailColumn, DetailCell>>;
}

/** What the table needs: the player's lines by column and their season totals. */
export interface DetailInputs {
  readonly lines: Readonly<Record<Exclude<DetailColumn, "season">, StatLine>>;
  readonly season: PlayerStatsResponse["players"][number] | null;
}

const NO_VALUE: DetailCell = { text: UNAVAILABLE, parts: null };

function lineCell(line: StatLine, category: LeagueCategory): DetailCell {
  const entry = categoryEntry(line, category);
  if (entry.kind !== "value") {
    return NO_VALUE;
  }
  return {
    text: formatTotal(category, entry.value),
    parts: entry.parts ? `${entry.parts.top}/${entry.parts.bottom}` : null,
  };
}

function seasonCell(season: DetailInputs["season"], category: LeagueCategory): DetailCell {
  if (season === null || season.gamesPlayed === 0) {
    return NO_VALUE;
  }
  const value = perGameAverages(season, [category])[category.statId] ?? null;
  const entry = categoryEntry(season.line, category);
  if (entry.kind === "value" && entry.parts) {
    const perGame = (total: number) => (total / season.gamesPlayed).toFixed(1);
    return {
      text: formatTotal(category, value),
      parts: `${perGame(entry.parts.top)}/${perGame(entry.parts.bottom)}`,
    };
  }
  return {
    text: value === null ? UNAVAILABLE : value.toFixed(category.makeup.kind === "ratio" ? 2 : 1),
    parts: null,
  };
}

/** The league's categories for today, yesterday, the week so far and the season's per-game average. */
export function detailRows(
  { lines, season }: DetailInputs,
  categories: readonly LeagueCategory[]
): DetailRow[] {
  return categories.map((category) => ({
    key: category.statId,
    label: categoryLabel(category),
    cells: {
      today: lineCell(lines.today, category),
      yesterday: lineCell(lines.yesterday, category),
      week: lineCell(lines.week, category),
      season: seasonCell(season, category),
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
