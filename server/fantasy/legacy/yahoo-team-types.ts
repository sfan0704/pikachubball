/**
 * The shape of a team in Yahoo's responses, as the legacy league discovery
 * reads it. Removed with the discovery.
 */

export interface YahooApiTeamProperties {
  team_key: string;
  name: string;
  managers?: { managers: { manager: { guid: string; nickname?: string; email?: string } }[] };
  [key: string]: any; // Yahoo may include other fields
}

export interface YahooApiTeamData {
  0: YahooApiTeamProperties[];
  1?: Record<string, unknown>;
}
