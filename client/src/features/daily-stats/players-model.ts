/**
 * The Players screen's rows: Yahoo's page of the player pool (D5) joined with
 * the period's averages (D4) and the league schedule (D6), and the filters
 * Yahoo can't apply itself (NBA team, tonight, tomorrow, back-to-back, games
 * left this week), which work on the page shown.
 */
import type { PlayerListResponse, PlayerStatsResponse, StatPeriod } from "@shared/api/daily-stats";
import {
  CATEGORIES,
  perGameAverages,
  type CategoryKey,
  type CategoryValues,
  type TeamSchedule,
} from "@shared/domain";
import { CATEGORY_LABELS, UNAVAILABLE } from "@/features/league/categories";

/** One player of the page, as Yahoo lists them. */
export type ListedPlayer = PlayerListResponse["players"][number];

/** Which list is shown: Yahoo's owned players, or everyone else (free agents and waivers). */
export type PlayerPool = "notOwned" | "owned";

/** The schedule filter; one choice at a time. */
export type ScheduleFilter = "any" | "tonight" | "tomorrow" | "backToBack";

/** What the screen filters on after Yahoo returns the page. */
export interface PageFilters {
  /** An NBA team abbreviation, or null for every team. */
  readonly nbaTeam: string | null;
  readonly schedule: ScheduleFilter;
  /** At least this many games left this week; 0 for any. */
  readonly minGamesLeft: number;
}

/** The pool names as the list bar shows them. */
export const POOL_LABELS: Readonly<Record<PlayerPool, string>> = {
  notOwned: "Not owned",
  owned: "Owned",
};

/** The schedule choices as the schedule bar shows them. */
export const SCHEDULE_LABELS: Readonly<Record<ScheduleFilter, string>> = {
  any: "Any day",
  tonight: "Tonight",
  tomorrow: "Tomorrow",
  backToBack: "B2B",
};

/** The period names as the stats bar shows them. */
export const PERIOD_LABELS: Readonly<Record<StatPeriod, string>> = {
  season: "Season",
  last7: "Last 7",
  last30: "Last 30",
};

/** What each period's values are, beside the player count. */
export const PERIOD_CAPTIONS: Readonly<Record<StatPeriod, string>> = {
  season: "season avg per game",
  last7: "last 7 days per game",
  last30: "last 30 days per game",
};

/** Yahoo's eligible positions and its two composite slots. */
export const POSITIONS = ["PG", "SG", "G", "SF", "PF", "F", "C"] as const;

/** "25 players" or "1 player": how many rows pass the filters. */
export function playerCountText(count: number): string {
  return `${count} ${count === 1 ? "player" : "players"}`;
}

/** How many of the sheet's filters (position, NBA team, games left) are on, for the Filters badge. */
export function activeFilterCount(position: string | null, filters: PageFilters): number {
  return [position !== null, filters.nbaTeam !== null, filters.minGamesLeft > 0].filter(Boolean)
    .length;
}

/** Yahoo's status for a player who isn't active in the NBA right now. */
const INACTIVE = "NA";

/** Whether Yahoo lists the player as not active (NA). */
export function isInactive(player: ListedPlayer["player"]): boolean {
  return player.injuryToday?.designation === INACTIVE;
}

/** The Yahoo status to ask for: not owned is Yahoo's "available", which includes waivers. */
export function poolStatus(pool: PlayerPool): "available" | "owned" {
  return pool === "owned" ? "owned" : "available";
}

/** "Wed": the weekday of a US Eastern date, as Yahoo names a waiver clear day. */
function weekdayOf(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** Who has the player: their fantasy team, "Clears Sun" for waivers, or nothing for a free agent. */
export function ownershipText(ownership: ListedPlayer["ownership"]): string | null {
  if (ownership.kind === "team") {
    return ownership.teamName;
  }
  return ownership.kind === "waivers" ? `Clears ${weekdayOf(ownership.clearsOn)}` : null;
}

/** "42%", or "<1%" when Yahoo leaves the value out, which it does under 1%; never 0. */
export function rosteredText(rostered: ListedPlayer["rostered"]): string {
  return rostered.percent === null ? "<1%" : `${rostered.percent}%`;
}

/** This week's change in percentage points, as an arrow and size: "▲3", "▼2" or "±0". */
export function rosteredChangeText(change: number): string {
  if (change === 0) {
    return "±0";
  }
  return change > 0 ? `▲${change}` : `▼${Math.abs(change)}`;
}

/** One day of the week strip on a player card. */
export interface WeekStripDay {
  readonly date: string;
  /** The weekday's short name and first letter: "Mon" and "M". */
  readonly name: string;
  readonly letter: string;
  readonly plays: boolean;
  readonly past: boolean;
  readonly today: boolean;
}

/** The scoring week's days for the card's strip, marked against today's Eastern date. */
export function weekStrip(schedule: TeamSchedule, today: string): WeekStripDay[] {
  return schedule.weekDays.map(({ date, plays }) => ({
    date,
    name: weekdayOf(date),
    letter: weekdayOf(date).charAt(0),
    plays,
    past: date < today,
    today: date === today,
  }));
}

/** "2/3 left": games left this week over the week's games, so the number has a reference. */
export function gamesLeftText(schedule: TeamSchedule): string {
  return `${schedule.gamesLeftThisWeek}/${schedule.gamesThisWeek} left`;
}

/** "Nov 9–15" or "Nov 30–Dec 6": the scoring week's dates for the games-left filter. */
export function weekRangeText(start: string, end: string): string {
  const format = (date: string, withMonth: boolean) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
      ...(withMonth ? { month: "short" } : {}),
      day: "numeric",
      timeZone: "UTC",
    });
  return `${format(start, true)}–${format(end, start.slice(5, 7) !== end.slice(5, 7))}`;
}

/** Whether a player passes the page filters; an NBA team missing from the schedule fails any schedule filter. */
export function passesFilters(
  player: ListedPlayer["player"],
  schedule: TeamSchedule | undefined,
  filters: PageFilters
): boolean {
  if (filters.nbaTeam !== null && player.nbaTeam !== filters.nbaTeam) {
    return false;
  }
  const needsSchedule = filters.schedule !== "any" || filters.minGamesLeft > 0;
  if (!needsSchedule) {
    return true;
  }
  if (schedule === undefined || schedule.gamesLeftThisWeek < filters.minGamesLeft) {
    return false;
  }
  return filters.schedule === "any" || schedule[filters.schedule];
}

/** Whether a period's average is clearly better or worse than the season's; null when close or unknown. */
export type AverageTone = "better" | "worse" | null;

/** One category's average as the row shows it. */
export interface AverageCell {
  readonly key: CategoryKey;
  readonly label: string;
  readonly text: string;
  readonly tone: AverageTone;
}

/** A player's period totals, as D4 sends them. */
export type PlayerTotals = PlayerStatsResponse["players"][number];

const isPercent = (key: CategoryKey) => key === "fgPct" || key === "ftPct";

function averageCellText(key: CategoryKey, value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }
  // Fantasy players read FG% and FT% as ".478"; the column already says it is a percentage.
  return isPercent(key) ? value.toFixed(3).replace(/^0/, "") : value.toFixed(1);
}

/**
 * Small swings aren't signal: a percentage must move 3 points, a counting stat
 * half a unit or a tenth of the season average, whichever is more.
 */
function toneAgainst(key: CategoryKey, value: number | null, season: number | null): AverageTone {
  if (value === null || season === null) {
    return null;
  }
  const change = value - season;
  const threshold = isPercent(key) ? 0.03 : Math.max(0.5, 0.1 * season);
  if (Math.abs(change) < threshold) {
    return null;
  }
  const higherIsBetter = key !== "to";
  return change > 0 === higherIsBetter ? "better" : "worse";
}

/**
 * The nine per-game averages for a player; unknown until the period's stats
 * arrive, and never 0 for missing. With the season's totals, each cell also
 * says whether the period is clearly above or below the season average.
 */
export function averageCells(
  totals: PlayerTotals | null,
  season: PlayerTotals | null = null
): AverageCell[] {
  const averages: CategoryValues | null = totals === null ? null : perGameAverages(totals);
  const baseline: CategoryValues | null = season === null ? null : perGameAverages(season);
  return CATEGORIES.map((key) => {
    const value = averages?.[key] ?? null;
    return {
      key,
      label: CATEGORY_LABELS[key],
      text: averageCellText(key, value),
      tone: toneAgainst(key, value, baseline?.[key] ?? null),
    };
  });
}

/** The NBA teams to offer in the team filter: every team the schedule or the page names, A to Z. */
export function nbaTeamChoices(
  scheduleTeams: readonly string[],
  page: readonly ListedPlayer[]
): string[] {
  return [...new Set([...scheduleTeams, ...page.map(({ player }) => player.nbaTeam)])].sort();
}

/** "Players 26–50": the page's place in Yahoo's list. */
export function pageRangeText(start: number, count: number): string {
  return count === 0 ? "No players" : `Players ${start + 1}–${start + count}`;
}
