import { lazy, Suspense, type ReactNode } from "react";
import type { UserLeague } from "@shared/api/leagues";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeagueScope } from "@/api/hooks";
import type { Selection } from "./selection";
import { TableBoundary } from "./TableBoundary";
import { useNow } from "./useNow";
import { LeagueControls } from "./LeagueControls";
import { optionFor, scopeOptions } from "./scope-options";
import { LeagueHeader } from "./LeagueHeader";
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
}

/** League: the league, team and period pickers, then the League board for that period. */
function LeagueScreen({ selection, leagues, onSelect, onPickLeague, query }: LeagueScreenProps) {
  const now = useNow();
  return (
    <>
      <LeagueControls
        selection={selection}
        leagues={leagues}
        table={query.data}
        onSelect={onSelect}
      />
      <TableBoundary query={query} now={now} onPickLeague={onPickLeague}>
        {(table) => (
          <Loading>
            <LeagueBoard
              table={table}
              leagueKey={selection.leagueKey}
              myTeamKey={selection.teamKey}
              periodLabel={
                optionFor(selection.scope, scopeOptions(table.settings.currentWeek)).label
              }
              onPickLeague={onPickLeague}
            />
          </Loading>
        )}
      </TableBoundary>
    </>
  );
}

/** The chosen screen: Matchup, Players or League. */
function ScreenBody(props: LeagueScreenProps) {
  const { selection, onPickLeague } = props;
  if (selection.screen === "matchup") {
    return (
      <Loading>
        <MatchupScreen selection={selection} onPickLeague={onPickLeague} />
      </Loading>
    );
  }
  if (selection.screen === "players") {
    return (
      <Loading>
        <PlayersScreen leagueKey={selection.leagueKey} onPickLeague={onPickLeague} />
      </Loading>
    );
  }
  return <LeagueScreen {...props} />;
}

/** The selected league: header, the screen navigation, and the chosen screen. */
export function LeagueView({ league, screens, ...rest }: LeagueViewProps) {
  const { selection } = rest;
  const query = useLeagueScope(selection.leagueKey, selection.scope);
  const teamName =
    query.data?.teams.find((team) => team.teamKey === selection.teamKey)?.teamName ?? null;
  return (
    <div className="space-y-4 md:space-y-6">
      <LeagueHeader league={league} teamName={teamName} />
      {screens.length > 1 && <ScreenNav selection={selection} screens={screens} />}
      <ScreenBody {...rest} query={query} />
    </div>
  );
}
