import { lazy, Suspense, type ReactNode } from "react";
import type { UserLeague } from "@shared/api/leagues";
import type { TeamTable } from "@shared/domain";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountControls } from "@/features/account/AccountControls";
import { useAccountActions } from "@/features/account/useAccountActions";
import { useLeagueScope } from "@/api/hooks";
import { RankingsView } from "./RankingsView";
import type { Selection } from "./selection";
import { TableBoundary } from "./TableBoundary";
import { useNow } from "./useNow";
import { LeagueControls } from "./LeagueControls";
import { optionFor, scopeOptions } from "./scope-options";
import { LeagueHeader } from "./LeagueHeader";
import type { Screen } from "./screens";
import { ScreenNav } from "@/features/daily-stats/ScreenNav";

// The daily-stats screens load when first opened, like the views below.
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

// The views other than the first load when their tab is first opened.
const HeatmapView = lazy(() => import("./HeatmapView").then((m) => ({ default: m.HeatmapView })));
const MatchupView = lazy(() => import("./MatchupView").then((m) => ({ default: m.MatchupView })));
const ComparisonView = lazy(() =>
  import("./ComparisonView").then((m) => ({ default: m.ComparisonView }))
);
const RosterPanel = lazy(() => import("./RosterView").then((m) => ({ default: m.RosterPanel })));

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

const TABS = ["rankings", "heatmap", "matchup", "compare", "roster", "account"] as const;

interface ViewTabsProps {
  selection: Selection;
  query: ReturnType<typeof useLeagueScope>;
  teamName: string | null;
  /** True when Matchup and League are wired: rankings show as the League board. */
  boardWired: boolean;
  onPickLeague: () => void;
}

/** The rankings tab: the League board when it is wired, else the rankings table. */
function Rankings({
  table,
  selection,
  boardWired,
  onPickLeague,
}: Pick<ViewTabsProps, "selection" | "boardWired" | "onPickLeague"> & { table: TeamTable }) {
  if (!boardWired) {
    return <RankingsView table={table} myTeamKey={selection.teamKey} />;
  }
  const period = optionFor(selection.scope, scopeOptions(table.settings.currentWeek));
  return (
    <Loading>
      <LeagueBoard
        table={table}
        leagueKey={selection.leagueKey}
        myTeamKey={selection.teamKey}
        periodLabel={period.label}
        onPickLeague={onPickLeague}
      />
    </Loading>
  );
}

function ViewTabList() {
  return (
    <TabsList className="flex h-auto w-full flex-wrap justify-start" aria-label="Views">
      {TABS.map((tab) => (
        <TabsTrigger key={tab} value={tab} className="min-h-[44px] capitalize">
          {tab}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

function ViewTabs({ selection, query, teamName, boardWired, onPickLeague }: ViewTabsProps) {
  const now = useNow();
  const actions = useAccountActions();
  const myTeamKey = selection.teamKey;
  const rankingsProps = { selection, boardWired, onPickLeague };
  const tableTab = (render: Parameters<typeof TableBoundary>[0]["children"]) => (
    <TableBoundary query={query} now={now} onPickLeague={onPickLeague}>
      {render}
    </TableBoundary>
  );
  return (
    <Tabs defaultValue="rankings" className="flex flex-col gap-4">
      <ViewTabList />
      <TabsContent value="rankings">
        {tableTab((table) => (
          <Rankings table={table} {...rankingsProps} />
        ))}
      </TabsContent>
      <TabsContent value="heatmap">
        <Loading>
          {tableTab((table) => (
            <HeatmapView table={table} myTeamKey={myTeamKey} />
          ))}
        </Loading>
      </TabsContent>
      <TabsContent value="matchup">
        <Loading>
          {tableTab((table) => (
            <MatchupView table={table} myTeamKey={myTeamKey} />
          ))}
        </Loading>
      </TabsContent>
      <TabsContent value="compare">
        <Loading>
          {tableTab((table) => (
            <ComparisonView table={table} myTeamKey={myTeamKey} />
          ))}
        </Loading>
      </TabsContent>
      <TabsContent value="roster">
        <Loading>
          <RosterPanel
            leagueKey={selection.leagueKey}
            teamKey={myTeamKey}
            teamName={teamName ?? "Team"}
            onPickLeague={onPickLeague}
          />
        </Loading>
      </TabsContent>
      <TabsContent value="account">
        <AccountControls actions={actions} />
      </TabsContent>
    </Tabs>
  );
}

interface ScreenBodyProps extends Omit<LeagueViewProps, "league" | "screens"> {
  query: ReturnType<typeof useLeagueScope>;
  teamName: string | null;
  boardWired: boolean;
}

/** The chosen screen: Matchup or Players, or League with its pickers and one tab per view. */
function ScreenBody({
  selection,
  leagues,
  onSelect,
  onPickLeague,
  query,
  teamName,
  boardWired,
}: ScreenBodyProps) {
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
  return (
    <>
      <LeagueControls
        selection={selection}
        leagues={leagues}
        table={query.data}
        onSelect={onSelect}
      />
      <ViewTabs
        selection={selection}
        query={query}
        teamName={teamName}
        boardWired={boardWired}
        onPickLeague={onPickLeague}
      />
    </>
  );
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
      <ScreenBody
        {...rest}
        query={query}
        teamName={teamName}
        // Matchup is listed exactly when the Matchup and League feature is wired.
        boardWired={screens.includes("matchup")}
      />
    </div>
  );
}
