import { useMemo } from "react";
import type { TeamTable } from "@shared/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeadToHeadTable } from "./HeadToHeadTable";
import { currentMatchup, OFFICIAL_TEXT } from "./matchup-model";

/** The week's matchup: Yahoo's opponent and official result, with the category totals compared. */
export function MatchupView({ table, myTeamKey }: { table: TeamTable; myTeamKey: string }) {
  const matchup = useMemo(() => currentMatchup(table, myTeamKey), [table, myTeamKey]);
  const myTeamName =
    table.teams.find((team) => team.teamKey === myTeamKey)?.teamName ?? "Your team";

  if (table.scope.kind !== "week" || !matchup) {
    return (
      <Card data-testid="card-matchup">
        <CardContent className="py-12 text-center text-muted-foreground" role="status">
          {table.scope.kind === "week"
            ? "Your team has no matchup in this week."
            : "Choose a week to see a matchup."}
        </CardContent>
      </Card>
    );
  }

  const { summary, official } = matchup;
  return (
    <Card data-testid="card-matchup">
      <CardHeader>
        <CardTitle>
          Week {table.scope.week}: {myTeamName} vs {summary.opponent.teamName}
        </CardTitle>
        <CardDescription>
          The tally compares totals so far. Yahoo decides the official result.
        </CardDescription>
        {official && (
          <Badge variant="outline" className="w-fit">
            {OFFICIAL_TEXT[official]}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <HeadToHeadTable myTeamName={myTeamName} summary={summary} />
      </CardContent>
    </Card>
  );
}
