import { useMemo } from "react";
import type { AllPlayTable, TeamTable } from "@shared/domain";
import { useSeasonWeekTables } from "@/api/hooks";
import { seasonAllPlayOf, weekAllPlay } from "./league-standings-model";

/** All-play for a table's period, as League needs it: ready, still loading, or failed. */
export interface AllPlayState {
  /** Each team's all-play; null while the season's weeks load or after one failed. */
  readonly table: AllPlayTable | null;
  readonly error: Error | null;
  readonly retry: () => void;
}

/**
 * A week's all-play comes from its own table. The season's adds up every
 * week's table, which loads only while something on screen needs it; the
 * weeks are cached, so the standings, a team sheet and the ⓘ share one load.
 */
export function useLeagueAllPlay(table: TeamTable, leagueKey: string): AllPlayState {
  const season = table.scope.kind === "season";
  const { startWeek, currentWeek } = table.settings;
  const weeks = useSeasonWeekTables(
    season ? leagueKey : null,
    season ? { startWeek, currentWeek } : null
  );
  const allPlay = useMemo(() => {
    if (!season) {
      return weekAllPlay(table);
    }
    return weeks.data ? seasonAllPlayOf(weeks.data) : null;
  }, [season, table, weeks.data]);
  return {
    table: allPlay,
    error: season ? weeks.error : null,
    retry: () => void weeks.refetch(),
  };
}
