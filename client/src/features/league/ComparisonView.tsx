import { useMemo, useState } from "react";
import type { TeamTable } from "@shared/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeadToHeadTable } from "./HeadToHeadTable";
import { comparisonRows, summarize } from "./matchup-model";

/** My team against every other team, from the same table: observed totals, not a prediction. */
export function ComparisonView({ table, myTeamKey }: { table: TeamTable; myTeamKey: string }) {
  const rows = useMemo(() => comparisonRows(table, myTeamKey), [table, myTeamKey]);
  const [chosen, setChosen] = useState<string | null>(null);
  const myTeamName =
    table.teams.find((team) => team.teamKey === myTeamKey)?.teamName ?? "Your team";
  const detail = chosen === null ? null : summarize(table, myTeamKey, chosen);

  return (
    <Card data-testid="card-comparison">
      <CardHeader>
        <CardTitle>{myTeamName} against every team</CardTitle>
        <p className="text-sm text-muted-foreground">
          A comparison of the totals so far, not a prediction of any matchup.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.opponent.teamKey}>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left hover:bg-muted aria-pressed:border-primary"
                aria-pressed={chosen === row.opponent.teamKey}
                onClick={() => setChosen(row.opponent.teamKey)}
                data-testid={`comparison-${row.opponent.teamKey}`}
              >
                <span className="line-clamp-1">{row.opponent.teamName}</span>
                <span className="font-semibold">{row.record}</span>
              </button>
            </li>
          ))}
        </ul>
        {detail ? (
          <HeadToHeadTable myTeamName={myTeamName} summary={detail} />
        ) : (
          <p className="text-sm text-muted-foreground">Choose a team to see every category.</p>
        )}
      </CardContent>
    </Card>
  );
}
