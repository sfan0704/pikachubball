import type { LeagueScope } from "@shared/api/league-scope";
import { weekLabel, type ScoringWeek } from "@/features/daily-stats/week-board";

export interface ScopeOption {
  readonly value: string;
  /** The period as the header and team pop-up name it, for example "Week 3 · Nov 2–8". */
  readonly label: string;
  /** Whether this is the week in progress, which the period picker marks "(now)". */
  readonly now: boolean;
  readonly scope: LeagueScope;
}

/** A week's name: with its dates once the scoring weeks have loaded, else just its number. */
function weekName(week: number, weeks: readonly ScoringWeek[] | undefined): string {
  const found = weeks?.find((candidate) => candidate.week === week);
  return found ? weekLabel(found) : `Week ${week}`;
}

/** The scopes to choose from: the season, this week, then each earlier week newest first. */
export function scopeOptions(
  currentWeek: number | null,
  weeks: readonly ScoringWeek[] | undefined
): ScopeOption[] {
  const options: ScopeOption[] = [
    { value: "season", label: "Season totals", now: false, scope: "season" },
    {
      value: "current",
      label: currentWeek === null ? "This week" : weekName(currentWeek, weeks),
      now: true,
      scope: "current",
    },
  ];
  for (let week = (currentWeek ?? 1) - 1; week >= 1; week -= 1) {
    options.push({ value: String(week), label: weekName(week, weeks), now: false, scope: week });
  }
  return options;
}

/** The option a scope corresponds to; a week beyond the list (a shared link) is added so it still shows. */
export function optionFor(scope: LeagueScope, options: readonly ScopeOption[]): ScopeOption {
  const found = options.find((option) => option.value === String(scope));
  return found ?? { value: String(scope), label: `Week ${scope}`, now: false, scope };
}

/** The option as the period picker lists it. */
export function optionText(option: ScopeOption): string {
  return option.now ? `${option.label} (now)` : option.label;
}
