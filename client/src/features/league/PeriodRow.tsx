import { LeagueExplanation } from "@/features/daily-stats/LeagueExplanation";
import type { Selection } from "./selection";
import { optionText, type ScopeOption } from "./scope-options";

interface PeriodRowProps {
  /** The periods to choose from, as `scopeOptions` lists them. */
  options: readonly ScopeOption[];
  /** The period shown; added to the list when a shared link names a week beyond it. */
  period: ScopeOption;
  onSelect: (change: Partial<Selection>) => void;
}

/** League's one row: the period picker (a plain select, so it works with any keyboard or screen reader) and the ⓘ. */
export function PeriodRow({ options, period, onSelect }: PeriodRowProps) {
  const shownOptions = options.some((option) => option.value === period.value)
    ? options
    : [...options, period];
  const choose = (value: string) =>
    onSelect({ scope: shownOptions.find((option) => option.value === value)?.scope });
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="scope-select" className="sr-only">
        Period
      </label>
      <select
        id="scope-select"
        className="min-h-9 min-w-0 flex-1 rounded-[10px] border border-[#D1D5DB] bg-white px-2 text-[0.8125rem] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-background"
        value={period.value}
        onChange={(event) => choose(event.target.value)}
      >
        {shownOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {optionText(option)}
          </option>
        ))}
      </select>
      <LeagueExplanation />
    </div>
  );
}
