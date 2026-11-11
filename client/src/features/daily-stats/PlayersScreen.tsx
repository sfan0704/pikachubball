import type { PlayerListQuery, PlayerListResponse } from "@shared/api/daily-stats";
import { usePlayerList } from "@/api/daily-stats-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatasetState } from "./DatasetState";

const FIRST_PAGE: PlayerListQuery = { status: "available", sort: "actualRank", start: 0 };

function PlayerRows({ page }: { page: PlayerListResponse }) {
  return (
    <ul className="space-y-2" data-testid="players-list">
      {page.players.map(({ player }) => (
        <li key={player.playerKey} className="rounded-lg border p-3">
          <p className="text-sm font-medium">{player.name}</p>
          <p className="text-xs text-muted-foreground">
            {player.positions.join(", ")} · {player.nbaTeam}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Players: the league's available players, best this season first. */
export function PlayersScreen({
  leagueKey,
  onPickLeague,
}: {
  leagueKey: string;
  onPickLeague: () => void;
}) {
  const page = usePlayerList(leagueKey, FIRST_PAGE);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Available players</CardTitle>
      </CardHeader>
      <CardContent>
        <DatasetState query={page} onPickLeague={onPickLeague}>
          {(data) => <PlayerRows page={data} />}
        </DatasetState>
      </CardContent>
    </Card>
  );
}
