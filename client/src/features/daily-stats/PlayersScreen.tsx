import { useEffect, useId, useMemo, useState } from "react";
import type { PlayerListQuery, PlayerListResponse, StatPeriod } from "@shared/api/daily-stats";
import { PLAYER_PAGE_SIZE } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { nbaDateOf, scheduleByTeam, type TeamSchedule } from "@shared/domain";
import { usePlayerList, usePlayerStats, useSchedule, useWeeks } from "@/api/daily-stats-hooks";
import { Button } from "@/components/ui/button";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { FreshnessLabel } from "./FreshnessLabel";
import { PlayerDetailSheet } from "./PlayerDetailSheet";
import { PlayerRow } from "./PlayerRow";
import { PlayersFilters, SegmentBar } from "./PlayersFilters";
import { PlayersToolbar } from "./PlayersToolbar";
import {
  PERIOD_CAPTIONS,
  PERIOD_LABELS,
  POOL_LABELS,
  SCHEDULE_LABELS,
  activeFilterCount,
  nbaTeamChoices,
  pageRangeText,
  passesFilters,
  playerCountText,
  poolStatus,
  weekRangeText,
  type ListedPlayer,
  type PageFilters,
  type PlayerPool,
  type ScheduleFilter,
} from "./players-model";
import {
  PLAYER_SORTS,
  SORT_LABELS,
  isCategorySort,
  sortPlayers,
  type PlayerSort,
} from "./players-sort";

/** Typing pauses this long before the search goes to Yahoo, so each keystroke isn't a call. */
const SEARCH_DELAY_MS = 300;
const NO_FILTERS: PageFilters = { nbaTeam: null, schedule: "any", minGamesLeft: 0 };
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

interface TeamSchedules {
  readonly byTeam: ReadonlyMap<string, TeamSchedule>;
  /** The current scoring week; null until the weeks arrive. */
  readonly week: { readonly start: string; readonly end: string } | null;
}

/** Each NBA team's tonight, tomorrow, back-to-back and week of games, once the schedule and weeks arrive. */
function useTeamSchedules(leagueKey: string, now: number): TeamSchedules {
  const schedule = useSchedule(leagueKey);
  const weeks = useWeeks(leagueKey);
  return useMemo(() => {
    const today = nbaDateOf(now);
    const week = weeks.data?.weeks.find(({ start, end }) => start <= today && today <= end) ?? null;
    if (schedule.data === undefined || week === null) {
      return { byTeam: new Map(), week };
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { byTeam: scheduleByTeam(schedule.data.teams, { now, timeZone, week }), week };
  }, [schedule.data, weeks.data, now]);
}

/** The page's players that pass the page filters, in Yahoo's order. */
function filteredRows(
  page: PlayerListResponse,
  schedules: ReadonlyMap<string, TeamSchedule>,
  filters: PageFilters
): ListedPlayer[] {
  return page.players.filter(({ player }) =>
    passesFilters(player, schedules.get(player.nbaTeam), filters)
  );
}

interface PlayerPageProps {
  leagueKey: string;
  page: PlayerListResponse;
  period: StatPeriod;
  filters: PageFilters;
  schedules: ReadonlyMap<string, TeamSchedule>;
  today: string;
  onOpenPlayer: (player: DailyPlayer) => void;
  onPage: (start: number) => void;
}

/** The count and period on the left, the sort menu on the right. */
function CountAndSort({
  count,
  period,
  sort,
  onSort,
}: {
  count: number;
  period: StatPeriod;
  sort: PlayerSort;
  onSort: (sort: PlayerSort) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[0.6875rem] text-muted-foreground" data-testid="players-count">
        {playerCountText(count)} · {PERIOD_CAPTIONS[period]}
      </span>
      <label htmlFor={id} className="sr-only">
        Sort by
      </label>
      <select
        id={id}
        value={sort}
        onChange={(event) => {
          const picked = PLAYER_SORTS.find((value) => value === event.target.value);
          if (picked !== undefined) {
            onSort(picked);
          }
        }}
        className="min-h-[34px] shrink-0 rounded-[10px] border border-input bg-background px-2 text-[0.8125rem] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        {PLAYER_SORTS.map((value) => (
          <option key={value} value={value}>
            {SORT_LABELS[value]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Previous and next 25, with the page's place in Yahoo's list between them. */
function Pager({ page, onPage }: { page: PlayerListResponse; onPage: (start: number) => void }) {
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        className="min-h-[44px] rounded-[10px]"
        disabled={page.start === 0}
        onClick={() => onPage(Math.max(0, page.start - PLAYER_PAGE_SIZE))}
      >
        Previous 25
      </Button>
      <span className="text-[0.6875rem] text-muted-foreground" data-testid="players-range">
        {pageRangeText(page.start, page.players.length)}
      </span>
      <Button
        variant="outline"
        className="min-h-[44px] rounded-[10px]"
        disabled={!page.hasMore}
        onClick={() => onPage(page.start + PLAYER_PAGE_SIZE)}
      >
        Next 25
      </Button>
    </nav>
  );
}

/** One page of 25: the count and sort, the cards that pass the page filters, then paging. */
function PlayerPage({
  leagueKey,
  page,
  period,
  filters,
  schedules,
  today,
  onOpenPlayer,
  onPage,
}: PlayerPageProps) {
  // Sorting reorders the page shown, so it lives with the page and survives paging.
  const [sort, setSort] = useState<PlayerSort>("rank");
  const keys = page.players.map(({ player }) => player.playerKey);
  const stats = usePlayerStats(leagueKey, period, keys);
  // The season's totals colour a shorter period; on Season this is the same request as above.
  const seasonStats = usePlayerStats(leagueKey, "season", keys);
  const totals = new Map(stats.data?.players.map((row) => [row.playerKey, row]));
  const season = new Map(seasonStats.data?.players.map((row) => [row.playerKey, row]));
  const rows = sortPlayers(filteredRows(page, schedules, filters), sort, totals);
  return (
    <div className="flex flex-col gap-2.5">
      <CountAndSort count={rows.length} period={period} sort={sort} onSort={setSort} />
      {rows.length === 0 ? (
        <p className="rounded-[10px] bg-muted/60 px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
          No players on this page match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="players-list">
          {rows.map((row) => (
            <PlayerRow
              key={row.player.playerKey}
              row={row}
              totals={totals.get(row.player.playerKey) ?? null}
              season={period === "season" ? null : (season.get(row.player.playerKey) ?? null)}
              schedule={schedules.get(row.player.nbaTeam)}
              today={today}
              sortedCategory={isCategorySort(sort) ? sort : null}
              onOpen={onOpenPlayer}
            />
          ))}
        </ul>
      )}
      <Pager page={page} onPage={onPage} />
      <p className="text-[0.6875rem] leading-snug text-muted-foreground">
        Amber cards are on waivers and clear on the day shown. Rostered % is across all Yahoo
        leagues, with this week&apos;s change. Green and red compare with the season average.
      </p>
    </div>
  );
}

/** The Yahoo-side choices (list, position, search) and the page, which resets when any of them changes. */
function usePlayerListQuery() {
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

interface PlayersControlsProps {
  list: ReturnType<typeof usePlayerListQuery>;
  filters: PageFilters;
  onFilters: (filters: PageFilters) => void;
  period: StatPeriod;
  onPeriod: (period: StatPeriod) => void;
  onOpenFilters: () => void;
}

/** Search and Filters, then the list, schedule and stats-period bars, top to bottom. */
function PlayersControls({
  list,
  filters,
  onFilters,
  period,
  onPeriod,
  onOpenFilters,
}: PlayersControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <PlayersToolbar
        searchText={list.searchText}
        onSearch={list.setSearchText}
        filterCount={activeFilterCount(list.position, filters)}
        onOpenFilters={onOpenFilters}
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
      <SegmentBar
        label="Stats"
        choices={choices(PERIODS, PERIOD_LABELS)}
        value={period}
        onChange={onPeriod}
      />
    </div>
  );
}

interface FiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: ReturnType<typeof usePlayerListQuery>;
  filters: PageFilters;
  onFilters: (filters: PageFilters) => void;
  schedules: TeamSchedules;
  /** The page shown, once it arrives; it adds its teams to the NBA team choices. */
  page: PlayerListResponse | undefined;
}

/** The Filters sheet wired to the list's position and the page filters; Clear leaves the bars alone. */
function FiltersSheet({
  open,
  onOpenChange,
  list,
  filters,
  onFilters,
  schedules,
  page,
}: FiltersSheetProps) {
  const shown = page === undefined ? 0 : filteredRows(page, schedules.byTeam, filters).length;
  const { week } = schedules;
  return (
    <PlayersFilters
      open={open}
      onOpenChange={onOpenChange}
      position={list.position}
      onPosition={list.setPosition}
      filters={filters}
      onFilters={onFilters}
      nbaTeams={nbaTeamChoices([...schedules.byTeam.keys()], page?.players ?? [])}
      weekText={week === null ? null : weekRangeText(week.start, week.end)}
      showLabel={`Show ${playerCountText(shown)}`}
      onClear={() => {
        list.setPosition(null);
        onFilters({ ...filters, nbaTeam: null, minGamesLeft: 0 });
      }}
    />
  );
}

/** Players: owned or not-owned players of the league, searched, filtered and sorted, with a period's averages. */
export function PlayersScreen({
  leagueKey,
  onPickLeague,
}: {
  leagueKey: string;
  onPickLeague: () => void;
}) {
  const now = useNow();
  const list = usePlayerListQuery();
  const [period, setPeriod] = useState<StatPeriod>("season");
  const [filters, setFilters] = useState<PageFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openPlayer, setOpenPlayer] = useState<DailyPlayer | null>(null);
  const page = usePlayerList(leagueKey, list.query);
  const schedules = useTeamSchedules(leagueKey, now);
  const today = nbaDateOf(now);
  return (
    <div className="flex flex-col gap-3">
      <FreshnessLabel sources={[page]} now={now} />
      <PlayersControls
        list={list}
        filters={filters}
        onFilters={setFilters}
        period={period}
        onPeriod={setPeriod}
        onOpenFilters={() => setFiltersOpen(true)}
      />
      <DatasetState query={page} onPickLeague={onPickLeague}>
        {(data) => (
          <PlayerPage
            leagueKey={leagueKey}
            page={data}
            period={period}
            filters={filters}
            schedules={schedules.byTeam}
            today={today}
            onOpenPlayer={setOpenPlayer}
            onPage={list.setStart}
          />
        )}
      </DatasetState>
      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        list={list}
        filters={filters}
        onFilters={setFilters}
        schedules={schedules}
        page={page.data}
      />
      <PlayerDetailSheet
        leagueKey={leagueKey}
        player={openPlayer}
        viewDate={today}
        onClose={() => setOpenPlayer(null)}
        onPickLeague={onPickLeague}
      />
    </div>
  );
}
