import { useState } from "react";
import type { PlayerListQuery, PlayerListResponse } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { nbaDateOf } from "@shared/domain";
import { usePlayerList } from "@/api/daily-stats-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { PlayerButton } from "./PlayerButton";
import { PlayerDetailSheet } from "./PlayerDetailSheet";

const FIRST_PAGE: PlayerListQuery = { status: "available", sort: "actualRank", start: 0 };

interface PlayerRowsProps {
  page: PlayerListResponse;
  onOpenPlayer: (player: DailyPlayer) => void;
}

/** Players lists today's pool, so each row shows today's injury tag. */
function PlayerRows({ page, onOpenPlayer }: PlayerRowsProps) {
  return (
    <ul className="space-y-2" data-testid="players-list">
      {page.players.map(({ player }) => (
        <li key={player.playerKey} className="flex items-center rounded-lg border p-3">
          <PlayerButton player={player} showInjury onOpen={onOpenPlayer} />
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
  const today = nbaDateOf(useNow());
  const [openPlayer, setOpenPlayer] = useState<DailyPlayer | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Available players</CardTitle>
      </CardHeader>
      <CardContent>
        <DatasetState query={page} onPickLeague={onPickLeague}>
          {(data) => <PlayerRows page={data} onOpenPlayer={setOpenPlayer} />}
        </DatasetState>
      </CardContent>
      <PlayerDetailSheet
        leagueKey={leagueKey}
        player={openPlayer}
        viewDate={today}
        onClose={() => setOpenPlayer(null)}
        onPickLeague={onPickLeague}
      />
    </Card>
  );
}
