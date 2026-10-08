import { ForbiddenError } from "../../shared/api/errors";
import type { RosterResponse, UserLeague } from "../../shared/api/leagues";
import type { YahooClientProvider } from "../request-context";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";
import { getUserLeagues } from "./yahoo/league-service";
import { getTeamRoster } from "./yahoo/roster-service";

type LeagueStorage = Pick<OwnerScopedStorage, "listUserLeagues" | "replaceUserLeagues">;

/** The user's stored leagues, or the stored list after replacing it with Yahoo's current one. */
export async function listLeagues(
  storage: LeagueStorage,
  yahooClient: YahooClientProvider,
  refresh: boolean
): Promise<UserLeague[]> {
  if (refresh) {
    const fromYahoo = await getUserLeagues(yahooClient);
    await storage.replaceUserLeagues(
      fromYahoo.map((league) => ({
        leagueKey: league.leagueKey,
        teamKey: league.teamKey,
        name: league.leagueName,
        season: league.season ?? null,
        isFinished: league.status === "finished",
      }))
    );
  }
  return storage.listUserLeagues();
}

/** One team's roster, for a league the user has. */
export async function getLeagueTeamRoster(
  storage: Pick<OwnerScopedStorage, "ownsLeague">,
  yahooClient: YahooClientProvider,
  leagueKey: string,
  teamKey: string
): Promise<RosterResponse> {
  if (!(await storage.ownsLeague(leagueKey))) {
    throw new ForbiddenError("League not available to this account");
  }
  return { roster: await getTeamRoster(teamKey, yahooClient) };
}
