import { useId, type CSSProperties } from "react";
import type { PlayerListResponse, StatPeriod } from "@shared/api/daily-stats";
import { PLAYER_PAGE_SIZE } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import type { LeagueCategory, TeamSchedule } from "@shared/domain";
import { usePlayerStats } from "@/api/daily-stats-hooks";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/features/league/categories";
import { DetailsPanel } from "./DetailsPanel";
import { PlayerDetails } from "./PlayerDetails";
import { PlayerRow } from "./PlayerRow";
import {
  PERIOD_CAPTIONS,
  pageRangeText,
  passesFilters,
  playerCountText,
  type ListedPlayer,
  type PageFilters,
  type PlayerTotals,
} from "./players-model";
import {
  playerSorts,
  sortLabel,
  sortedCategory,
  sortPlayers,
  type PlayerSort,
} from "./players-sort";

/** The page's players that pass the page filters, in Yahoo's order. */
export function filteredRows(
  page: PlayerListResponse,
  schedules: ReadonlyMap<string, TeamSchedule>,
  filters: PageFilters
): ListedPlayer[] {
  return page.players.filter(({ player }) =>
    passesFilters(player, schedules.get(player.nbaTeam), filters)
  );
}

/** The count and period on the left, the sort menu on the right. */
function CountAndSort({
  count,
  period,
  sort,
  onSort,
  categories,
}: {
  count: number;
  period: StatPeriod;
  sort: PlayerSort;
  onSort: (sort: PlayerSort) => void;
  categories: readonly LeagueCategory[];
}) {
  const id = useId();
  const sorts = playerSorts(categories);
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
          const picked = sorts.find((value) => value === event.target.value);
          if (picked !== undefined) {
            onSort(picked);
          }
        }}
        className="min-h-[34px] shrink-0 rounded-[10px] border border-input bg-background px-2 text-[0.8125rem] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sorts.map((value) => (
          <option key={value} value={value}>
            {sortLabel(value, categories)}
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

/**
 * From md each card lines up as a table row under one header: the player, the
 * week, rostered %, then one column per league category. The columns are a CSS
 * variable so the header and every row share them; the minimum width makes a
 * league with many categories scroll inside the list, never the page.
 */
function columnStyle(categoryCount: number): CSSProperties {
  return {
    "--player-columns": `minmax(7.5rem, 1.6fr) 8.25rem 4.5rem repeat(${categoryCount}, minmax(2.375rem, 1fr))`,
    "--player-table-width": `calc(${categoryCount} * 2.375rem + ${categoryCount + 2} * 0.375rem + 21.75rem)`,
  } as CSSProperties;
}

/** The column names over the rows from md; each row's numbers carry their own names for screen readers. */
function ColumnHeader({ categories }: { categories: readonly LeagueCategory[] }) {
  return (
    <div
      aria-hidden
      className="hidden grid-cols-(--player-columns) gap-x-1.5 px-3 pb-1.5 text-[0.625rem] font-bold text-muted-foreground md:grid"
    >
      <span>Player</span>
      <span>This week</span>
      <span className="text-right">Rostered</span>
      {categories.map((category) => (
        <span key={category.statId} className="text-center">
          {categoryLabel(category)}
        </span>
      ))}
    </div>
  );
}

interface PlayerTableProps {
  rows: readonly ListedPlayer[];
  totals: ReadonlyMap<string, PlayerTotals>;
  /** The season's totals to colour a shorter period against; null on Season itself. */
  season: ReadonlyMap<string, PlayerTotals> | null;
  schedules: ReadonlyMap<string, TeamSchedule>;
  today: string;
  sort: PlayerSort;
  categories: readonly LeagueCategory[];
  /** The player the panel shows, from lg. */
  selectedKey: string | undefined;
  onOpen: (player: DailyPlayer) => void;
}

/**
 * The rows under their column header, scrolling sideways inside the list from
 * md when the categories need it; or why there are none.
 */
function PlayerTable({
  rows,
  totals,
  season,
  schedules,
  today,
  sort,
  categories,
  selectedKey,
  onOpen,
}: PlayerTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[10px] bg-muted/60 px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
        No players on this page match these filters.
      </p>
    );
  }
  return (
    <div className="md:-mx-1 md:overflow-x-auto md:px-1 md:py-0.5">
      <div style={columnStyle(categories.length)} className="md:min-w-(--player-table-width)">
        <ColumnHeader categories={categories} />
        <ul className="flex flex-col gap-2.5 md:gap-1.5" data-testid="players-list">
          {rows.map((row) => (
            <PlayerRow
              key={row.player.playerKey}
              row={row}
              totals={totals.get(row.player.playerKey) ?? null}
              season={season === null ? null : (season.get(row.player.playerKey) ?? null)}
              schedule={schedules.get(row.player.nbaTeam)}
              today={today}
              sortedCategory={sortedCategory(sort, categories)}
              categories={categories}
              selected={row.player.playerKey === selectedKey}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

interface PlayerPageProps {
  leagueKey: string;
  page: PlayerListResponse;
  period: StatPeriod;
  filters: PageFilters;
  schedules: ReadonlyMap<string, TeamSchedule>;
  today: string;
  sort: PlayerSort;
  onSort: (sort: PlayerSort) => void;
  categories: readonly LeagueCategory[];
  /** The player picked in the list; null until one is. */
  picked: DailyPlayer | null;
  /** True from lg, where the picked player's details stay open beside the list. */
  showPanel: boolean;
  onOpenPlayer: (player: DailyPlayer) => void;
  onPage: (start: number) => void;
  onPickLeague: () => void;
}

/** The page's period and season totals by player, and its rows after the page filters and the sort. */
function usePageRows({
  leagueKey,
  page,
  period,
  filters,
  schedules,
  sort,
  categories,
}: PlayerPageProps) {
  const keys = page.players.map(({ player }) => player.playerKey);
  const stats = usePlayerStats(leagueKey, period, keys);
  // The season's totals colour a shorter period; on Season this is the same request as above.
  const seasonStats = usePlayerStats(leagueKey, "season", keys);
  const totals = new Map(stats.data?.players.map((row) => [row.playerKey, row]));
  const season = new Map(seasonStats.data?.players.map((row) => [row.playerKey, row]));
  const rows = sortPlayers(filteredRows(page, schedules, filters), sort, totals, categories);
  return { rows, totals, season };
}

/** The player the panel shows: the picked one while they are in the list, else the first row. */
function panelPlayer(rows: readonly ListedPlayer[], picked: DailyPlayer | null) {
  return (rows.find(({ player }) => player.playerKey === picked?.playerKey) ?? rows[0])?.player;
}

/**
 * One page of 25: the count and sort, the cards that pass the page filters,
 * then paging. From lg the details panel sits beside it, showing the picked
 * player while they are in the list and the first player otherwise.
 */
export function PlayerPage(props: PlayerPageProps) {
  const { leagueKey, page, period, schedules, today, sort, onSort, categories } = props;
  const { rows, totals, season } = usePageRows(props);
  const shown = props.showPanel ? panelPlayer(rows, props.picked) : undefined;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-5">
      <div className="flex min-w-0 flex-col gap-2.5 md:rounded-2xl md:border md:bg-card md:p-5">
        <CountAndSort
          count={rows.length}
          period={period}
          sort={sort}
          onSort={onSort}
          categories={categories}
        />
        <PlayerTable
          rows={rows}
          totals={totals}
          season={period === "season" ? null : season}
          schedules={schedules}
          today={today}
          sort={sort}
          categories={categories}
          selectedKey={shown?.playerKey}
          onOpen={props.onOpenPlayer}
        />
        <Pager page={page} onPage={props.onPage} />
        <p className="text-[0.6875rem] leading-snug text-muted-foreground">
          Amber cards are on waivers and clear on the day shown. Rostered % is across all Yahoo
          leagues, with this week&apos;s change. Green and red compare with the season average.
        </p>
      </div>
      {shown !== undefined && (
        <DetailsPanel testId="player-panel">
          <PlayerDetails
            leagueKey={leagueKey}
            player={shown}
            viewDate={today}
            onPickLeague={props.onPickLeague}
          />
        </DetailsPanel>
      )}
    </div>
  );
}
