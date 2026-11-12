import { lazy, Suspense, type ReactNode } from "react";
import type { UserLeague } from "@shared/api/leagues";
import { nbaDateOf } from "@shared/domain";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeagueScope } from "@/api/hooks";
import { useWeeks } from "@/api/daily-stats-hooks";
import { weekFor, weekLabel } from "@/features/daily-stats/week-board";
import { ShellSlot } from "@/features/shell/shell-slots";
import type { Selection } from "./selection";
import { TableBoundary } from "./TableBoundary";
import { useNow } from "./useNow";
import { PeriodRow } from "./PeriodRow";
import { optionFor, scopeOptions } from "./scope-options";
import { LeagueSwitcher } from "./LeagueSwitcher";
import type { Screen } from "./screens";
import { ScreenNav } from "@/features/daily-stats/ScreenNav";

// Each screen loads when first opened.
const MatchupScreen = lazy(() =>
  import("@/features/daily-stats/MatchupScreen").then((m) => ({ default: m.MatchupScreen }))
);
const PlayersScreen = lazy(() =>
  import("@/features/daily-stats/PlayersScreen").then((m) => ({ default: m.PlayersScreen }))
);
const LeagueBoard = lazy(() =>
  import("@/features/daily-stats/LeagueBoard").then((m) => ({ default: m.LeagueBoard }))
);

interface LeagueViewProps {
  selection: Selection;
  leagues: readonly UserLeague[];
  league: UserLeague;
  /** The screens the server has wired; the navigation shows when there is more than one. */
  screens: readonly Screen[];
  onSelect: (change: Partial<Selection>) => void;
  onPickLeague: () => void;
}

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading">
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

interface LeagueScreenProps extends Omit<LeagueViewProps, "league" | "screens"> {
  query: ReturnType<typeof useLeagueScope>;
  /** The signed-in user's team in this league, which the board always ranks against. */
  myTeamKey: string;
}

/** League: the period row, then the League board for that period. */
function LeagueScreen({ selection, onSelect, onPickLeague, query, myTeamKey }: LeagueScreenProps) {
  const now = useNow();
  const weeks = useWeeks(selection.leagueKey);
  const options = scopeOptions(query.data?.settings.currentWeek ?? null, weeks.data?.weeks);
  const period = optionFor(selection.scope, options);
  return (
    <div className="space-y-3">
      <ShellSlot name="context">{period.label}</ShellSlot>
      <PeriodRow options={options} period={period} onSelect={onSelect} />
      <TableBoundary query={query} now={now} onPickLeague={onPickLeague}>
        {(table) => (
          <Loading>
            <LeagueBoard
              table={table}
              leagueKey={selection.leagueKey}
              myTeamKey={myTeamKey}
              periodLabel={period.label}
              onPickLeague={onPickLeague}
            />
          </Loading>
        )}
      </TableBoundary>
    </div>
  );
}

/** The header's period for Matchup and Players: the week shown, as "Week 3 · Nov 2–8". */
function WeekContext({ selection }: { selection: Selection }) {
  const now = useNow();
  const weeks = useWeeks(selection.leagueKey);
  const scope =
    selection.screen === "matchup" && selection.day === "week" ? selection.scope : "current";
  const week = weeks.data ? weekFor(weeks.data.weeks, scope, nbaDateOf(now)) : undefined;
  return week ? <ShellSlot name="context">{weekLabel(week)}</ShellSlot> : null;
}

/** The chosen screen: Matchup, Players or League. */
function ScreenBody(props: LeagueScreenProps) {
  const { selection, onPickLeague } = props;
  if (selection.screen === "matchup") {
    return (
      <Loading>
        <WeekContext selection={selection} />
        <MatchupScreen selection={selection} onPickLeague={onPickLeague} />
      </Loading>
    );
  }
  if (selection.screen === "players") {
    return (
      <Loading>
        <WeekContext selection={selection} />
        <PlayersScreen leagueKey={selection.leagueKey} onPickLeague={onPickLeague} />
      </Loading>
    );
  }
  return <LeagueScreen {...props} />;
}

/** The selected league: its name in the header, the chosen screen, and the bottom tab bar. */
export function LeagueView({ league, screens, ...rest }: LeagueViewProps) {
  const { selection, leagues, onSelect } = rest;
  const query = useLeagueScope(selection.leagueKey, selection.scope);
  return (
    <>
      <ShellSlot name="league">
        <LeagueSwitcher
          league={league}
          leagues={leagues}
          onPick={(leagueKey) => onSelect({ leagueKey })}
        />
      </ShellSlot>
      <div className="space-y-4">
        <ScreenBody {...rest} query={query} myTeamKey={league.teamKey} />
      </div>
      {screens.length > 1 && <ScreenNav selection={selection} screens={screens} />}
    </>
  );
}
