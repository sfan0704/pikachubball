import { useEffect, useMemo, useState } from "react";
import type { PlayerListQuery, PlayerListResponse, StatPeriod } from "@shared/api/daily-stats";
import { PLAYER_PAGE_SIZE } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { nbaDateOf, scheduleByTeam, type TeamSchedule } from "@shared/domain";
import { usePlayerList, usePlayerStats, useSchedule, useWeeks } from "@/api/daily-stats-hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { FreshnessLabel } from "./FreshnessLabel";
import { PlayerDetailSheet } from "./PlayerDetailSheet";
import { PlayerRow } from "./PlayerRow";
import { PlayersFilters, SegmentBar } from "./PlayersFilters";
import {
  PERIOD_CAPTIONS,
  PERIOD_LABELS,
  POOL_LABELS,
  SCHEDULE_LABELS,
  nbaTeamChoices,
  pageRangeText,
  passesFilters,
  poolStatus,
  type PageFilters,
  type PlayerPool,
  type ScheduleFilter,
} from "./players-model";

/** Typing pauses this long before the search goes to Yahoo, so each keystroke isn't a call. */
const SEARCH_DELAY_MS = 300;
const SEARCH_MAX_LENGTH = 40;
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

/** Each NBA team's tonight, tomorrow, back-to-back and games left, once the schedule and weeks arrive. */
function useTeamSchedules(leagueKey: string, now: number): ReadonlyMap<string, TeamSchedule> {
  const schedule = useSchedule(leagueKey);
  const weeks = useWeeks(leagueKey);
  return useMemo(() => {
    const today = nbaDateOf(now);
    const week = weeks.data?.weeks.find(({ start, end }) => start <= today && today <= end);
    if (schedule.data === undefined || week === undefined) {
      return new Map();
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return scheduleByTeam(schedule.data.teams, { now, timeZone, week });
  }, [schedule.data, weeks.data, now]);
}

interface PlayerPageProps {
  leagueKey: string;
  page: PlayerListResponse;
  period: StatPeriod;
  filters: PageFilters;
  schedules: ReadonlyMap<string, TeamSchedule>;
  onOpenPlayer: (player: DailyPlayer) => void;
  onPage: (start: number) => void;
}

/** One page of 25: the rows that pass the page filters, then the paging buttons. */
function PlayerPage({
  leagueKey,
  page,
  period,
  filters,
  schedules,
  onOpenPlayer,
  onPage,
}: PlayerPageProps) {
  const keys = page.players.map(({ player }) => player.playerKey);
  const stats = usePlayerStats(leagueKey, period, keys);
  const totals = new Map(stats.data?.players.map((row) => [row.playerKey, row]));
  const rows = page.players.filter(({ player }) =>
    passesFilters(player, schedules.get(player.nbaTeam), filters)
  );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground" data-testid="players-range">
        {pageRangeText(page.start, page.players.length)} · {PERIOD_CAPTIONS[period]}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No players on this page match these filters.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="players-list">
          {rows.map((row) => (
            <PlayerRow
              key={row.player.playerKey}
              row={row}
              totals={totals.get(row.player.playerKey) ?? null}
              schedule={schedules.get(row.player.nbaTeam)}
              onOpen={onOpenPlayer}
            />
          ))}
        </ul>
      )}
      <nav aria-label="Pages" className="flex justify-between gap-2">
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={page.start === 0}
          onClick={() => onPage(Math.max(0, page.start - PLAYER_PAGE_SIZE))}
        >
          Previous 25
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={!page.hasMore}
          onClick={() => onPage(page.start + PLAYER_PAGE_SIZE)}
        >
          Next 25
        </Button>
      </nav>
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

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="sr-only">Search players</span>
      <input
        type="search"
        value={value}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Search players"
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[44px] w-full rounded-[10px] border bg-background px-3 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

interface PlayersControlsProps {
  list: ReturnType<typeof usePlayerListQuery>;
  filters: PageFilters;
  onFilters: (filters: PageFilters) => void;
  period: StatPeriod;
  onPeriod: (period: StatPeriod) => void;
  nbaTeams: readonly string[];
}

/** Search, the list, the filters and the stats period, top to bottom. */
function PlayersControls({
  list,
  filters,
  onFilters,
  period,
  onPeriod,
  nbaTeams,
}: PlayersControlsProps) {
  return (
    <>
      <SearchBox value={list.searchText} onChange={list.setSearchText} />
      <SegmentBar
        label="List"
        choices={choices(POOLS, POOL_LABELS)}
        value={list.pool}
        onChange={list.setPool}
      />
      <PlayersFilters
        position={list.position}
        onPosition={list.setPosition}
        filters={filters}
        onFilters={onFilters}
        nbaTeams={nbaTeams}
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
    </>
  );
}

/** Players: owned or not-owned players of the league, searched and filtered, with a period's averages. */
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
  const [openPlayer, setOpenPlayer] = useState<DailyPlayer | null>(null);
  const page = usePlayerList(leagueKey, list.query);
  const schedules = useTeamSchedules(leagueKey, now);
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Players</CardTitle>
        <FreshnessLabel sources={[page]} now={now} />
      </CardHeader>
      <CardContent className="space-y-3">
        <PlayersControls
          list={list}
          filters={filters}
          onFilters={setFilters}
          period={period}
          onPeriod={setPeriod}
          nbaTeams={nbaTeamChoices([...schedules.keys()], page.data?.players ?? [])}
        />
        <DatasetState query={page} onPickLeague={onPickLeague}>
          {(data) => (
            <PlayerPage
              leagueKey={leagueKey}
              page={data}
              period={period}
              filters={filters}
              schedules={schedules}
              onOpenPlayer={setOpenPlayer}
              onPage={list.setStart}
            />
          )}
        </DatasetState>
      </CardContent>
      <PlayerDetailSheet
        leagueKey={leagueKey}
        player={openPlayer}
        viewDate={nbaDateOf(now)}
        onClose={() => setOpenPlayer(null)}
        onPickLeague={onPickLeague}
      />
    </Card>
  );
}
