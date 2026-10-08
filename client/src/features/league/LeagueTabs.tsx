import type { UserLeague } from "@shared/api/leagues";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountControls } from "@/features/account/AccountControls";
import { useAccountActions } from "@/features/account/useAccountActions";
import { useLeagueScope } from "@/api/hooks";
import { ComparisonView } from "./ComparisonView";
import { HeatmapView } from "./HeatmapView";
import { MatchupView } from "./MatchupView";
import { RankingsView } from "./RankingsView";
import { RosterPanel } from "./RosterView";
import type { Selection } from "./selection";
import { TableBoundary } from "./TableBoundary";
import { useNow } from "./useNow";
import { LeagueControls } from "./LeagueControls";
import { LeagueHeader } from "./LeagueHeader";

interface LeagueViewProps {
  selection: Selection;
  leagues: readonly UserLeague[];
  league: UserLeague;
  onSelect: (change: Partial<Selection>) => void;
  onPickLeague: () => void;
}

const TABS = ["rankings", "heatmap", "matchup", "compare", "roster", "account"] as const;

interface ViewTabsProps {
  selection: Selection;
  query: ReturnType<typeof useLeagueScope>;
  teamName: string | null;
  onPickLeague: () => void;
}

function ViewTabs({ selection, query, teamName, onPickLeague }: ViewTabsProps) {
  const now = useNow();
  const actions = useAccountActions();
  const myTeamKey = selection.teamKey;
  const tableTab = (render: Parameters<typeof TableBoundary>[0]["children"]) => (
    <TableBoundary query={query} now={now} onPickLeague={onPickLeague}>
      {render}
    </TableBoundary>
  );
  return (
    <Tabs defaultValue="rankings" className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start" aria-label="Views">
        {TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="min-h-[44px] capitalize">
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="rankings">
        {tableTab((table) => (
          <RankingsView table={table} myTeamKey={myTeamKey} />
        ))}
      </TabsContent>
      <TabsContent value="heatmap">
        {tableTab((table) => (
          <HeatmapView table={table} myTeamKey={myTeamKey} />
        ))}
      </TabsContent>
      <TabsContent value="matchup">
        {tableTab((table) => (
          <MatchupView table={table} myTeamKey={myTeamKey} />
        ))}
      </TabsContent>
      <TabsContent value="compare">
        {tableTab((table) => (
          <ComparisonView table={table} myTeamKey={myTeamKey} />
        ))}
      </TabsContent>
      <TabsContent value="roster">
        <RosterPanel
          leagueKey={selection.leagueKey}
          teamKey={myTeamKey}
          teamName={teamName ?? "Team"}
          onPickLeague={onPickLeague}
        />
      </TabsContent>
      <TabsContent value="account">
        <AccountControls actions={actions} />
      </TabsContent>
    </Tabs>
  );
}

/** The selected league: header, pickers and one tab per view, all fed by the one team table. */
export function LeagueView({
  selection,
  leagues,
  league,
  onSelect,
  onPickLeague,
}: LeagueViewProps) {
  const query = useLeagueScope(selection.leagueKey, selection.scope);
  const teamName =
    query.data?.teams.find((team) => team.teamKey === selection.teamKey)?.teamName ?? null;
  return (
    <div className="space-y-4 md:space-y-6">
      <LeagueHeader league={league} teamName={teamName} />
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
        onPickLeague={onPickLeague}
      />
    </div>
  );
}
