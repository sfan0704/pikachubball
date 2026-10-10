import { ForbiddenError } from "../../shared/api/errors";
import type { RosterResponse, UserLeague } from "../../shared/api/leagues";
import type { YahooClientProvider } from "../http/request-context";
import type { Clock } from "../utils/clock";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";
import type { FantasyDataSource } from "../fantasy/fantasy-data-source";
import { getTeamRoster } from "../fantasy/yahoo/roster-service";

type LeagueStorage = Pick<OwnerScopedStorage, "listUserLeagues" | "replaceUserLeagues">;
type LeagueSource = Pick<FantasyDataSource, "listLeagues">;

/** How long a list of only finished leagues is trusted before Yahoo is asked about a new season. */
const ROLLOVER_CHECK_MS = 24 * 60 * 60 * 1000;

/** Replaces the user's stored leagues with the ones Yahoo lists now; rows Yahoo dropped go. */
export async function syncLeagues(storage: LeagueStorage, dataSource: LeagueSource): Promise<void> {
  const fromYahoo = await dataSource.listLeagues();
  await storage.replaceUserLeagues(
    fromYahoo.map((league) => ({
      leagueKey: league.leagueKey,
      teamKey: league.teamKey,
      name: league.name,
      season: league.season,
      isFinished: league.status === "finished",
    }))
  );
}

/**
 * Nothing stored means the sign-in sync didn't finish. Only finished leagues,
 * synced more than a day ago, means a new season may have opened since.
 */
function needsSync(stored: readonly UserLeague[], now: number): boolean {
  if (stored.length === 0) {
    return true;
  }
  return stored.every(
    (league) => league.isFinished && now - Date.parse(league.syncedAt) > ROLLOVER_CHECK_MS
  );
}

/** The user's stored leagues, synced from Yahoo first when asked to or when they are due. */
export async function listLeagues(
  storage: LeagueStorage,
  dataSource: LeagueSource,
  refresh: boolean,
  clock: Clock
): Promise<UserLeague[]> {
  if (!refresh) {
    const stored = await storage.listUserLeagues();
    if (!needsSync(stored, clock.now())) {
      return stored;
    }
  }
  await syncLeagues(storage, dataSource);
  return storage.listUserLeagues();
}

/** One team's roster, for a league the user has. */
export async function getLeagueTeamRoster(
  storage: Pick<OwnerScopedStorage, "ownsLeague">,
  yahooClient: YahooClientProvider,
  leagueKey: string,
  teamKey: string,
  clock: Clock
): Promise<RosterResponse> {
  if (!(await storage.ownsLeague(leagueKey))) {
    throw new ForbiddenError("League not available to this account");
  }
  const roster = await getTeamRoster(teamKey, yahooClient);
  return { fetchedAt: new Date(clock.now()).toISOString(), roster };
}
