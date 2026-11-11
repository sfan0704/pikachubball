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

/** What each period's values are, under the stats bar. */
export const PERIOD_CAPTIONS: Readonly<Record<StatPeriod, string>> = {
  season: "Season average per game",
  last7: "Last 7 days, average per game",
  last30: "Last 30 days, average per game",
};

/** Yahoo's eligible positions and its two composite slots. */
export const POSITIONS = ["PG", "SG", "G", "SF", "PF", "F", "C"] as const;

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

/** Who has the player: their fantasy team, "Waivers until Sun", or nothing for a free agent. */
export function ownershipText(ownership: ListedPlayer["ownership"]): string | null {
  if (ownership.kind === "team") {
    return ownership.teamName;
  }
  return ownership.kind === "waivers" ? `Waivers until ${weekdayOf(ownership.clearsOn)}` : null;
}

/** "42%", or "<1%" when Yahoo leaves the value out, which it does under 1%; never 0. */
export function rosteredText(rostered: ListedPlayer["rostered"]): string {
  return rostered.percent === null ? "<1%" : `${rostered.percent}%`;
}

/** This week's change in percentage points, signed: "+3", "−2" or "±0". */
export function rosteredChangeText(change: number): string {
  if (change === 0) {
    return "±0";
  }
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
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

/** One category's average as the row shows it. */
export interface AverageCell {
  readonly key: CategoryKey;
  readonly label: string;
  readonly text: string;
}

function averageCellText(key: CategoryKey, value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }
  // The column says FG% or FT%, so the cell drops the sign to fit nine across a phone.
  return key === "fgPct" || key === "ftPct" ? (value * 100).toFixed(1) : value.toFixed(1);
}

/** The nine per-game averages for a player; unknown until the period's stats arrive, and never 0 for missing. */
export function averageCells(totals: PlayerStatsResponse["players"][number] | null): AverageCell[] {
  const averages: CategoryValues | null = totals === null ? null : perGameAverages(totals);
  return CATEGORIES.map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    text: averageCellText(key, averages?.[key] ?? null),
  }));
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
