import { useMemo, useState } from "react";
import type { StatPeriod } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { nbaDateOf, scheduleByTeam } from "@shared/domain";
import { usePlayerList, useSchedule, useWeeks } from "@/api/daily-stats-hooks";
import { useLeagueScope } from "@/api/hooks";
import { useNow } from "@/features/league/useNow";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { DatasetState } from "./DatasetState";
import { FreshnessLabel } from "./FreshnessLabel";
import { NO_CATEGORIES } from "./matchup-board";
import { PlayerDetailSheet } from "./PlayerDetailSheet";
import { PlayerPage } from "./PlayerPage";
import { PlayersControls, usePlayerListQuery, type TeamSchedules } from "./PlayersControls";
import type { PageFilters } from "./players-model";
import type { PlayerSort } from "./players-sort";

const NO_FILTERS: PageFilters = { nbaTeam: null, schedule: "any", minGamesLeft: 0 };

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

/** The league whose players are shown, and the way back to picking a league. */
interface PlayersScreenProps {
  leagueKey: string;
  onPickLeague: () => void;
}

/** Players: owned or not-owned players of the league, searched, filtered and sorted, with a period's averages. */
export function PlayersScreen({ leagueKey, onPickLeague }: PlayersScreenProps) {
  const now = useNow();
  const list = usePlayerListQuery();
  const [period, setPeriod] = useState<StatPeriod>("season");
  const [filters, setFilters] = useState<PageFilters>(NO_FILTERS);
  // The page unmounts while the next one loads, so the sort is kept here to survive paging.
  const [sort, setSort] = useState<PlayerSort>("rank");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The picked player: in a sheet on a phone, a drawer from md, the panel beside the list from lg.
  const [picked, setPicked] = useState<DailyPlayer | null>(null);
  const breakpoint = useBreakpoint();
  const page = usePlayerList(leagueKey, list.query);
  // The current week's table names the league's categories; Matchup reads the same one.
  const table = useLeagueScope(leagueKey, "current");
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
        schedules={schedules}
        page={page.data}
        inToolbar={breakpoint !== "phone"}
        filtersOpen={filtersOpen}
        onFiltersOpen={setFiltersOpen}
      />
      <DatasetState query={page} onPickLeague={onPickLeague}>
        {(data) => (
          <PlayerPage
            categories={table.data?.settings.categories ?? NO_CATEGORIES}
            leagueKey={leagueKey}
            page={data}
            period={period}
            filters={filters}
            schedules={schedules.byTeam}
            today={today}
            sort={sort}
            onSort={setSort}
            picked={picked}
            showPanel={breakpoint === "lg"}
            onOpenPlayer={setPicked}
            onPage={list.setStart}
            onPickLeague={onPickLeague}
          />
        )}
      </DatasetState>
      <PlayerDetailSheet
        leagueKey={leagueKey}
        player={breakpoint === "lg" ? null : picked}
        viewDate={today}
        side={breakpoint === "md" ? "right" : "bottom"}
        onClose={() => setPicked(null)}
        onPickLeague={onPickLeague}
      />
    </div>
  );
}
