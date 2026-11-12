import { useId } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
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
    <div
      role="group"
      aria-label={label}
      className="flex w-full gap-0.5 rounded-[10px] bg-muted p-[3px] dark:bg-muted/70"
    >
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={choice.value === value}
          onClick={() => onChange(choice.value)}
          className={cn(
            "min-h-[32px] min-w-0 flex-1 rounded-md px-1 text-xs font-semibold",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            choice.value === value
              ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
              : "text-foreground/75 hover:text-foreground"
          )}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

const SELECT_CLASS =
  "min-h-[34px] w-full min-w-0 rounded-[10px] border border-input bg-background px-1.5 text-[0.8125rem] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

interface LabelledSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

function LabelledSelect({ label, value, options, onChange }: LabelledSelectProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <label htmlFor={id} className="text-[0.625rem] font-bold text-muted-foreground">
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
const SECTION_TITLE = "text-xs font-bold uppercase tracking-[0.5px] text-foreground/80";
const SHEET_BUTTON =
  "min-h-[44px] rounded-[10px] bg-background text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

/** Clear every sheet filter, or close the sheet showing how many players are left. */
function SheetActions({
  showLabel,
  onClear,
  onDone,
}: {
  showLabel: string;
  onClear: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onClear}
        className={cn(SHEET_BUTTON, "flex-1 border border-input text-foreground/80")}
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onDone}
        className={cn(SHEET_BUTTON, "flex-[2] border-2 border-foreground")}
      >
        {showLabel}
      </button>
    </div>
  );
}

/** Position, as a segmented bar; Yahoo filters on it, composite G and F included. */
function PositionSection({
  position,
  onPosition,
}: {
  position: string | null;
  onPosition: (position: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={SECTION_TITLE}>Position</span>
      <SegmentBar
        label="Position"
        choices={[
          { value: ANY, label: "All" },
          ...POSITIONS.map((item) => ({ value: item, label: item })),
        ]}
        value={position ?? ANY}
        onChange={(value) => onPosition(value === ANY ? null : value)}
      />
    </div>
  );
}

interface PlayersFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A position or composite slot Yahoo filters on, or null for every position. */
  position: string | null;
  onPosition: (position: string | null) => void;
  filters: PageFilters;
  onFilters: (filters: PageFilters) => void;
  nbaTeams: readonly string[];
  /** "Nov 9–15": the scoring week games left counts in; null until the weeks arrive. */
  weekText: string | null;
  /** "Show 12 players": how many rows the filters leave on this page. */
  showLabel: string;
  onClear: () => void;
}

/**
 * The Filters sheet: position (Yahoo filters it), then NBA team and games left
 * this week (filtered on the page). Choices apply as they change; the main
 * button closes the sheet and says how many players are left.
 */
export function PlayersFilters({
  open,
  onOpenChange,
  position,
  onPosition,
  filters,
  onFilters,
  nbaTeams,
  weekText,
  showLabel,
  onClear,
}: PlayersFiltersProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col gap-[18px] px-4 pb-7 pt-3"
        data-testid="players-filters"
      >
        <SheetTitle className="text-base font-bold">Filters</SheetTitle>
        <SheetDescription className="sr-only">
          Narrow the players list by position, NBA team and games left this week.
        </SheetDescription>
        <PositionSection position={position} onPosition={onPosition} />
        <LabelledSelect
          label="NBA team"
          value={filters.nbaTeam ?? ANY}
          options={[
            { value: ANY, label: "All teams" },
            ...nbaTeams.map((team) => ({ value: team, label: team })),
          ]}
          onChange={(value) => onFilters({ ...filters, nbaTeam: value === ANY ? null : value })}
        />
        <div className="flex flex-col gap-2">
          <span className={SECTION_TITLE}>
            Games this week{weekText === null ? "" : ` · ${weekText}`}
          </span>
          <LabelledSelect
            label="Games left"
            value={String(filters.minGamesLeft)}
            options={GAMES_LEFT_CHOICES.map((count) => ({
              value: String(count),
              label: count === 0 ? "Any" : `${count} or more`,
            }))}
            onChange={(value) => onFilters({ ...filters, minGamesLeft: Number(value) })}
          />
        </div>
        <SheetActions showLabel={showLabel} onClear={onClear} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
