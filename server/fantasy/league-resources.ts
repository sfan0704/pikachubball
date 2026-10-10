import { ValidationError } from "../../shared/api/errors";

/** Anything that can make an authenticated Yahoo Fantasy GET and return its JSON. */
export interface YahooRequester {
  get(endpoint: string): Promise<unknown>;
}

/** The Yahoo calls behind the data source, one request each. Settings arrive with the stats. */
export interface LeagueResources {
  /** `/users;use_login=1/games;game_codes=nba/teams` */
  getUserTeams(): Promise<unknown>;
  /** `/users;use_login=1/games;game_codes=nba/leagues` */
  getUserLeagues(): Promise<unknown>;
  /** `/league/{key};out=settings,standings` */
  getSeasonStandings(leagueKey: string): Promise<unknown>;
  /** `/league/{key};out=settings,scoreboard` */
  getCurrentWeekScoreboard(leagueKey: string): Promise<unknown>;
  /** `/league/{key};out=settings/scoreboard;week={n}` */
  getPastWeekScoreboard(leagueKey: string, week: number): Promise<unknown>;
}

const LEAGUE_KEY = /^\d+\.l\.\d+$/;

/** Rejects anything that isn't a Yahoo league key before it reaches a URL. */
function checkedLeagueKey(leagueKey: string): string {
  if (!LEAGUE_KEY.test(leagueKey)) {
    throw new ValidationError("Invalid league key");
  }
  return leagueKey;
}

/** League resources over a lazily created Yahoo requester. */
export class YahooLeagueResources implements LeagueResources {
  constructor(private readonly requester: () => Promise<YahooRequester>) {}

  async getUserTeams(): Promise<unknown> {
    const requester = await this.requester();
    return requester.get("/users;use_login=1/games;game_codes=nba/teams");
  }

  async getUserLeagues(): Promise<unknown> {
    const requester = await this.requester();
    return requester.get("/users;use_login=1/games;game_codes=nba/leagues");
  }

  async getSeasonStandings(leagueKey: string): Promise<unknown> {
    const requester = await this.requester();
    return requester.get(`/league/${checkedLeagueKey(leagueKey)};out=settings,standings`);
  }

  async getCurrentWeekScoreboard(leagueKey: string): Promise<unknown> {
    const requester = await this.requester();
    return requester.get(`/league/${checkedLeagueKey(leagueKey)};out=settings,scoreboard`);
  }

  async getPastWeekScoreboard(leagueKey: string, week: number): Promise<unknown> {
    if (!Number.isInteger(week) || week < 1) {
      throw new ValidationError("Invalid week");
    }
    const requester = await this.requester();
    return requester.get(
      `/league/${checkedLeagueKey(leagueKey)};out=settings/scoreboard;week=${week}`
    );
  }
}
