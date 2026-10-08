import type { TeamTable } from "../../shared/domain";
import type { LeagueResources } from "./league-resources";
import { parseSeasonTable, parseWeekTable } from "./league-tables";

/** Which week a table covers: the league's current week or a specific one. */
export type WeekSelector = number | "current";

/**
 * The only way the app reads fantasy data. It returns validated domain types;
 * nothing outside this module sees Yahoo's format.
 */
export interface FantasyDataSource {
  getSeason(leagueKey: string): Promise<TeamTable>;
  getWeek(leagueKey: string, week: WeekSelector): Promise<TeamTable>;
}

/** FantasyDataSource backed by Yahoo's league resources. */
export class YahooFantasyDataSource implements FantasyDataSource {
  constructor(
    private readonly resources: LeagueResources,
    private readonly clock: { now(): number }
  ) {}

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
