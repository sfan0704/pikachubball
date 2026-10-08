import { ForbiddenError } from "../../shared/api/errors";
import type { LeagueScope } from "../../shared/api/league-scope";
import type { TeamTable } from "../../shared/domain";
import type { FantasyDataSource } from "../fantasy/fantasy-data-source";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";

/**
 * The team table for one of the user's leagues. The league must be in the
 * user's stored leagues; otherwise Yahoo is never called.
 */
export async function getLeagueScope(
  storage: Pick<OwnerScopedStorage, "ownsLeague">,
  dataSource: FantasyDataSource,
  leagueKey: string,
  scope: LeagueScope
): Promise<TeamTable> {
  if (!(await storage.ownsLeague(leagueKey))) {
    throw new ForbiddenError("League not available to this account");
  }
  return scope === "season"
    ? dataSource.getSeason(leagueKey)
    : dataSource.getWeek(leagueKey, scope);
}
