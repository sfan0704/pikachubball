import type { YahooClientProvider } from "../../http/request-context";
import { parsePlayersFromRoster } from "./player-parser.js";
import type { RosterResponse } from "../../../shared/api/leagues";

/**
 * Roster Service
 * Business logic for roster-related operations using direct Yahoo API calls
 */

function child(value: unknown, key: string | number): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string | number, unknown>)[key]
    : undefined;
}

/**
 * Get roster for a specific team
 * Returns DTO format (Player from schema) for frontend compatibility
 */
export async function getTeamRoster(
  teamKey: string,
  yahooClient: YahooClientProvider
): Promise<RosterResponse["roster"]> {
  const client = await yahooClient();
  const response = await client.getTeamRoster(teamKey);

  // The roster sits at fantasy_content.team[1].roster
  const rosterData = child(child(child(response, "fantasy_content"), "team"), 1);
  const roster = child(rosterData, "roster");
  if (typeof roster !== "object" || roster === null) {
    return [];
  }

  // Use parser to extract players (domain models)
  const domainPlayers = parsePlayersFromRoster({ roster });

  // Convert to DTO format (Player from schema uses 'team' instead of 'nbaTeam')
  return domainPlayers.map((player) => ({
    playerKey: player.playerKey,
    name: player.name,
    position: player.position,
    team: player.nbaTeam, // Convert nbaTeam to team for DTO
    status: player.status,
  }));
}
