/**
 * The Players screen's schedule filters, worked out in the browser from the
 * league schedule (D6). Tonight and tomorrow follow the viewer's clock and
 * time zone; games this week follow Yahoo's scoring week, which is dated in
 * US Eastern like each game's date.
 */
import { addDays, nbaDateOf } from "./nba-date";

/** One game of a team: its US Eastern date and its state's tip-off instant (ISO 8601), as D6 sends it. */
export interface ScheduledGame {
  readonly date: string;
  readonly state: { readonly tipOff: string };
}

/** The days the filters look at: now in the display time zone, and the current scoring week. */
export interface ScheduleContext {
  /** Epoch milliseconds. */
  readonly now: number;
  /** An IANA time zone, for example "America/Los_Angeles". */
  readonly timeZone: string;
  /** The current Yahoo scoring week's first and last dates (D10). */
  readonly week: { readonly start: string; readonly end: string };
}

/** What the filters need to know about one NBA team. */
export interface TeamSchedule {
  readonly tonight: boolean;
  readonly tomorrow: boolean;
  /** Plays tonight and tomorrow. */
  readonly backToBack: boolean;
  /** Games on or after today's Eastern date and inside the scoring week. */
  readonly gamesLeftThisWeek: number;
  /** Every game inside the scoring week, played or not. */
  readonly gamesThisWeek: number;
  /** Each date of the scoring week, first to last, and whether the team plays on it (Eastern dates). */
  readonly weekDays: readonly WeekDay[];
}

/** One date of the scoring week for one team. */
export interface WeekDay {
  /** YYYY-MM-DD, US Eastern. */
  readonly date: string;
  readonly plays: boolean;
}

/** The dates from start to end, both included. */
function datesFrom(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** The YYYY-MM-DD date of an instant in a time zone. */
export function localDateOf(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

/** One team's filter facts from its games. */
export function teamSchedule(
  games: readonly ScheduledGame[],
  context: ScheduleContext
): TeamSchedule {
  const today = localDateOf(context.now, context.timeZone);
  const tomorrow = addDays(today, 1);
  const localDates = new Set(
    games.map((game) => localDateOf(Date.parse(game.state.tipOff), context.timeZone))
  );
  const nbaToday = nbaDateOf(context.now);
  const from = nbaToday > context.week.start ? nbaToday : context.week.start;
  const playsTonight = localDates.has(today);
  const playsTomorrow = localDates.has(tomorrow);
  const { start, end } = context.week;
  const gameDates = new Set(games.map((game) => game.date));
  return {
    tonight: playsTonight,
    tomorrow: playsTomorrow,
    backToBack: playsTonight && playsTomorrow,
    gamesLeftThisWeek: games.filter((game) => game.date >= from && game.date <= end).length,
    gamesThisWeek: games.filter((game) => game.date >= start && game.date <= end).length,
    weekDays: datesFrom(start, end).map((date) => ({ date, plays: gameDates.has(date) })),
  };
}

/** Each NBA team's filter facts, keyed by team abbreviation. A team not listed is unknown, not idle. */
export function scheduleByTeam(
  teams: readonly { readonly nbaTeam: string; readonly games: readonly ScheduledGame[] }[],
  context: ScheduleContext
): ReadonlyMap<string, TeamSchedule> {
  return new Map(teams.map((team) => [team.nbaTeam, teamSchedule(team.games, context)]));
}
