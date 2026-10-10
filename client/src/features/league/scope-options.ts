import type { LeagueScope } from "@shared/api/league-scope";

export interface ScopeOption {
  readonly value: string;
  readonly label: string;
  readonly scope: LeagueScope;
}

/** The scopes to choose from: the season, this week, then each earlier week newest first. */
export function scopeOptions(currentWeek: number | null): ScopeOption[] {
  const options: ScopeOption[] = [
    { value: "season", label: "Season to date", scope: "season" },
    { value: "current", label: "This week", scope: "current" },
  ];
  for (let week = (currentWeek ?? 1) - 1; week >= 1; week -= 1) {
    options.push({ value: String(week), label: `Week ${week}`, scope: week });
  }
  return options;
}

/** The option a scope corresponds to; a week beyond the list (a shared link) is added so it still shows. */
export function optionFor(scope: LeagueScope, options: readonly ScopeOption[]): ScopeOption {
  const found = options.find((option) => option.value === String(scope));
  return found ?? { value: String(scope), label: `Week ${scope}`, scope };
}
