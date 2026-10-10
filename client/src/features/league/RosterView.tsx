import type { RosterResponse } from "@shared/api/leagues";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoster } from "@/api/hooks";
import { ErrorScreen } from "./ErrorScreen";

const STATUS_TEXT: Record<RosterResponse["roster"][number]["status"], string> = {
  active: "Active",
  injured: "Injured",
  out: "Out",
};

const STATUS_CLASS = {
  active: "border-green-600/30 text-green-700 dark:text-green-400",
  injured: "border-yellow-600/30 text-yellow-700 dark:text-yellow-400",
  out: "border-red-600/30 text-red-700 dark:text-red-400",
} as const;

/** The date a roster applies to, in the viewer's language. */
export function formatRosterDate(fetchedAt: string): string {
  return new Date(fetchedAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** A team's players with their Yahoo eligibility, status and NBA team, and the date it applies to. */
export function RosterView({ data, teamName }: { data: RosterResponse; teamName: string }) {
  return (
    <Card data-testid="card-roster">
      <CardHeader>
        <CardTitle>{teamName} roster</CardTitle>
        <CardDescription>Roster as of {formatRosterDate(data.fetchedAt)}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.roster.length === 0 ? (
          <p className="text-muted-foreground" role="status">
            Yahoo lists no players on this roster.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.roster.map((player) => (
              <li
                key={player.playerKey}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                data-testid={`roster-player-${player.playerKey}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">{player.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {player.position} · {player.team}
                  </p>
                </div>
                <Badge variant="outline" className={STATUS_CLASS[player.status]}>
                  {STATUS_TEXT[player.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface RosterPanelProps {
  leagueKey: string;
  teamKey: string;
  teamName: string;
  onPickLeague: () => void;
}

/** Loads and shows the selected team's roster, with the same loading and error states as the tables. */
export function RosterPanel({ leagueKey, teamKey, teamName, onPickLeague }: RosterPanelProps) {
  const roster = useRoster(leagueKey, teamKey);
  if (roster.data) {
    return <RosterView data={roster.data} teamName={teamName} />;
  }
  if (roster.error) {
    return (
      <ErrorScreen
        error={roster.error}
        onRetry={() => roster.refetch()}
        onPickLeague={onPickLeague}
      />
    );
  }
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
