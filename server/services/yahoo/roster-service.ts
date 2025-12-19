import { getYahooApiClient } from "./yahoo-api-client";
import { parsePlayersFromRoster } from "../parsers/player-parser.js";
import type { Player as DomainPlayer } from "@shared/domain";
import type { Player } from "@shared/schema";

/**
 * Roster Service
 * Business logic for roster-related operations using direct Yahoo API calls
 */

/**
 * Get roster for a specific team
 * Returns DTO format (Player from schema) for frontend compatibility
 */
export async function getTeamRoster(
  userId: string,
  teamKey: string
): Promise<Player[]> {
  const client = await getYahooApiClient(userId);
  const response = await client.getTeamRoster(teamKey);

  // Parse the raw Yahoo API response
  const teamData = response?.fantasy_content?.team;
  if (!teamData || !Array.isArray(teamData) || teamData.length < 2) {
    return [];
  }

  const rosterData = teamData[1]?.roster;
  if (!rosterData || !Array.isArray(rosterData) || rosterData.length === 0) {
    return [];
  }

  // Use parser to extract players (domain models)
  const domainPlayers = parsePlayersFromRoster({ roster: rosterData });
  
  // Convert to DTO format (Player from schema uses 'team' instead of 'nbaTeam')
  return domainPlayers.map(player => ({
    playerKey: player.playerKey,
    name: player.name,
    position: player.position,
    team: player.nbaTeam, // Convert nbaTeam to team for DTO
    status: player.status,
  }));
}

