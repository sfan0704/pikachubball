import { useId } from "react";
import { cn } from "@/lib/utils";
import { POSITIONS, type PageFilters } from "./players-model";

/** One choice in a segmented bar. */
export interface SegmentChoice<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentBarProps<T extends string> {
  /** Names the bar for screen readers, for example "List". */
  label: string;
  choices: readonly SegmentChoice<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A single choice that stays on this screen, as a segmented bar of toggle
 * buttons. Unlike the link bars, these choices aren't part of the URL.
 */
export function SegmentBar<T extends string>({
  label,
  choices,
  value,
  onChange,
}: SegmentBarProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex w-full gap-1 rounded-[10px] bg-muted p-1">
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={choice.value === value}
          onClick={() => onChange(choice.value)}
          className={cn(
            "min-h-[44px] min-w-0 flex-1 rounded-md px-1 text-sm font-medium",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            choice.value === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

const SELECT_CLASS =
  "min-h-[44px] w-full min-w-0 rounded-[10px] border bg-background px-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

interface LabelledSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

function LabelledSelect({ label, value, options, onChange }: LabelledSelectProps) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const ANY = "";
const GAMES_LEFT_CHOICES = [0, 1, 2, 3, 4];

interface PlayersFiltersProps {
  /** A position or composite slot Yahoo filters on, or null for every position. */
  position: string | null;
  onPosition: (position: string | null) => void;
  filters: PageFilters;
  onFilters: (filters: PageFilters) => void;
  nbaTeams: readonly string[];
}

/** Position (Yahoo filters it), then NBA team and games left this week (filtered on the page). */
export function PlayersFilters({
  position,
  onPosition,
  filters,
  onFilters,
  nbaTeams,
}: PlayersFiltersProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <LabelledSelect
        label="Position"
        value={position ?? ANY}
        options={[
          { value: ANY, label: "All" },
          ...POSITIONS.map((item) => ({ value: item, label: item })),
        ]}
        onChange={(value) => onPosition(value === ANY ? null : value)}
      />
      <LabelledSelect
        label="NBA team"
        value={filters.nbaTeam ?? ANY}
        options={[
          { value: ANY, label: "All" },
          ...nbaTeams.map((team) => ({ value: team, label: team })),
        ]}
        onChange={(value) => onFilters({ ...filters, nbaTeam: value === ANY ? null : value })}
      />
      <LabelledSelect
        label="Games left"
        value={String(filters.minGamesLeft)}
        options={GAMES_LEFT_CHOICES.map((count) => ({
          value: String(count),
          label: count === 0 ? "Any" : `${count}+`,
        }))}
        onChange={(value) => onFilters({ ...filters, minGamesLeft: Number(value) })}
      />
    </div>
  );
}
