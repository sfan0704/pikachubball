import { useEffect, useState } from "react";
import type { PlayerListQuery, PlayerListResponse, StatPeriod } from "@shared/api/daily-stats";
import type { TeamSchedule } from "@shared/domain";
import { filteredRows } from "./PlayerPage";
import { ClearFiltersButton, FilterFields, PlayersFilters, SegmentBar } from "./PlayersFilters";
import { PlayersToolbar } from "./PlayersToolbar";
import {
  PERIOD_LABELS,
  POOL_LABELS,
  SCHEDULE_LABELS,
  activeFilterCount,
  nbaTeamChoices,
  playerCountText,
  poolStatus,
  weekRangeText,
  type PageFilters,
  type PlayerPool,
  type ScheduleFilter,
} from "./players-model";

/** Typing pauses this long before the search goes to Yahoo, so each keystroke isn't a call. */
const SEARCH_DELAY_MS = 300;
const POOLS: readonly PlayerPool[] = ["notOwned", "owned"];
const SCHEDULES: readonly ScheduleFilter[] = ["any", "tonight", "tomorrow", "backToBack"];
const PERIODS: readonly StatPeriod[] = ["season", "last7", "last30"];

function choices<T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** The search text once typing has paused; blank is no search. */
function useSettledSearch(text: string): string | undefined {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(text), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);
  const trimmed = settled.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The Yahoo-side choices (list, position, search) and the page, which resets when any of them changes. */
export function usePlayerListQuery() {
  const [pool, setPool] = useState<PlayerPool>("notOwned");
  const [position, setPosition] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const search = useSettledSearch(searchText);
  // Paging belongs to one list, position and search; any change starts from Yahoo's first page.
  const listKey = `${pool}|${position ?? ""}|${search ?? ""}`;
  const [paging, setPaging] = useState({ listKey, start: 0 });
  const query: PlayerListQuery = {
    status: poolStatus(pool),
    sort: "actualRank",
    start: paging.listKey === listKey ? paging.start : 0,
    ...(position === null ? {} : { position }),
    ...(search === undefined ? {} : { search }),
  };
  return {
    pool,
    setPool,
    position,
    setPosition,
    searchText,
    setSearchText,
    query,
    setStart: (start: number) => setPaging({ listKey, start }),
  };
}

/** Each NBA team's schedule, and the current scoring week once the weeks arrive. */
export interface TeamSchedules {
  readonly byTeam: ReadonlyMap<string, TeamSchedule>;
  /** The current scoring week; null until the weeks arrive. */
  readonly week: { readonly start: string; readonly end: string } | null;
}

interface PlayersControlsProps {
  list: ReturnType<typeof usePlayerListQuery>;
  filters: PageFilters;
  onFilters: (filters: PageFilters) => void;
  period: StatPeriod;
  onPeriod: (period: StatPeriod) => void;
  schedules: TeamSchedules;
  /** The page shown, once it arrives; it adds its teams to the NBA team choices. */
  page: PlayerListResponse | undefined;
  /** From md the filters sit in the toolbar; on a phone they are in the Filters sheet. */
  inToolbar: boolean;
  filtersOpen: boolean;
  onFiltersOpen: (open: boolean) => void;
}

/** The filters' state, choices and Clear, the same for the sheet and the toolbar; Clear leaves the bars alone. */
function filterFields(
  list: ReturnType<typeof usePlayerListQuery>,
  filters: PageFilters,
  onFilters: (filters: PageFilters) => void,
  schedules: TeamSchedules,
  page: PlayerListResponse | undefined
) {
  const { week } = schedules;
  return {
    position: list.position,
    onPosition: list.setPosition,
    filters,
    onFilters,
    nbaTeams: nbaTeamChoices([...schedules.byTeam.keys()], page?.players ?? []),
    weekText: week === null ? null : weekRangeText(week.start, week.end),
    onClear: () => {
      list.setPosition(null);
      onFilters({ ...filters, nbaTeam: null, minGamesLeft: 0 });
    },
  };
}

/**
 * Every Players choice, one state at every width. On a phone: search and the
 * Filters button, then the list, schedule and stats-period bars, with position,
 * NBA team and games left in the Filters sheet. From md the same controls form
 * a toolbar card, with those filters and Clear in it instead of the sheet.
 */
export function PlayersControls({
  list,
  filters,
  onFilters,
  period,
  onPeriod,
  schedules,
  page,
  inToolbar,
  filtersOpen,
  onFiltersOpen,
}: PlayersControlsProps) {
  const fields = filterFields(list, filters, onFilters, schedules, page);
  const shown = page === undefined ? 0 : filteredRows(page, schedules.byTeam, filters).length;
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:rounded-2xl md:border md:bg-card md:p-5">
      <PlayersToolbar
        searchText={list.searchText}
        onSearch={list.setSearchText}
        filterCount={activeFilterCount(list.position, filters)}
        onOpenFilters={() => onFiltersOpen(true)}
      />
      <SegmentBar
        label="List"
        choices={choices(POOLS, POOL_LABELS)}
        value={list.pool}
        onChange={list.setPool}
      />
      <SegmentBar
        label="Schedule"
        choices={choices(SCHEDULES, SCHEDULE_LABELS)}
        value={filters.schedule}
        onChange={(schedule) => onFilters({ ...filters, schedule })}
      />
      {inToolbar && (
        <div className="flex flex-wrap items-center gap-3">
          <FilterFields {...fields} />
          <ClearFiltersButton onClear={fields.onClear} />
        </div>
      )}
      <SegmentBar
        label="Stats"
        choices={choices(PERIODS, PERIOD_LABELS)}
        value={period}
        onChange={onPeriod}
        className="md:ml-auto"
      />
      <PlayersFilters
        open={filtersOpen && !inToolbar}
        onOpenChange={onFiltersOpen}
        showLabel={`Show ${playerCountText(shown)}`}
        {...fields}
      />
    </div>
  );
}
