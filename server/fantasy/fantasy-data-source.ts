import type { TeamTable } from "../../shared/domain";
import type { LeagueResources } from "./league-resources";
import { parseSeasonTable, parseWeekTable } from "./league-tables";
import { parseUserLeagues, type DiscoveredLeague } from "./user-leagues";

// Yahoo's NBA dates follow the league's schedule, which is set in US Eastern time.
const NBA_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

/** Which week a table covers: the league's current week or a specific one. */
export type WeekSelector = number | "current";

/**
 * The only way the app reads fantasy data. It returns validated domain types;
 * nothing outside this module sees Yahoo's format.
 */
export interface FantasyDataSource {
  /** The user's NBA leagues in every season, each with the user's team. Empty when there are none. */
  listLeagues(): Promise<DiscoveredLeague[]>;
  getSeason(leagueKey: string): Promise<TeamTable>;
  getWeek(leagueKey: string, week: WeekSelector): Promise<TeamTable>;
}

/** FantasyDataSource backed by Yahoo's league resources. */
export class YahooFantasyDataSource implements FantasyDataSource {
  constructor(
    private readonly resources: LeagueResources,
    private readonly clock: { now(): number }
  ) {}

  async listLeagues(): Promise<DiscoveredLeague[]> {
    const [teams, leagues] = await Promise.all([
      this.resources.getUserTeams(),
      this.resources.getUserLeagues(),
    ]);
    return parseUserLeagues(teams, leagues, NBA_DATE.format(this.clock.now()));
  }

  async getSeason(leagueKey: string): Promise<TeamTable> {
    const response = await this.resources.getSeasonStandings(leagueKey);
    return parseSeasonTable(response, this.fetchedAt());
  }

  async getWeek(leagueKey: string, week: WeekSelector): Promise<TeamTable> {
    if (week === "current") {
      const response = await this.resources.getCurrentWeekScoreboard(leagueKey);
      return parseWeekTable(response, this.fetchedAt());
    }
    const response = await this.resources.getPastWeekScoreboard(leagueKey, week);
    return parseWeekTable(response, this.fetchedAt(), week);
  }

  private fetchedAt(): string {
    return new Date(this.clock.now()).toISOString();
  }
}
