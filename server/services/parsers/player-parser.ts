/**
 * Player Parser
 * Transform raw Yahoo API player responses into domain models
 */

import type { Player, PlayerStatus } from '@shared/domain';
import type { YahooApiPlayerData } from '../../types/yahoo-api.js';
import { logger } from '../../utils/logger.js';

/**
 * Parse player status from Yahoo API format
 * @param status Yahoo API status string
 * @returns PlayerStatus
 */
function parsePlayerStatus(status: string | undefined): PlayerStatus {
  if (!status) {
    return 'active';
  }

  const statusLower = status.toLowerCase();
  if (statusLower === 'il' || statusLower === 'il+') {
    return 'injured';
  }
  if (statusLower === 'o' || statusLower === 'gtd' || statusLower === 'inj') {
    return 'out';
  }
  return 'active';
}

/**
 * Parse player name from Yahoo API format
 * @param nameObj Yahoo API name object or string
 * @returns Player name string
 */
function parsePlayerName(nameObj: any): string {
  if (!nameObj) {
    return 'Unknown Player';
  }

  if (typeof nameObj === 'string') {
    return nameObj;
  }

  if (typeof nameObj === 'object') {
    return nameObj.full || nameObj.first + ' ' + (nameObj.last || '') || 'Unknown Player';
  }

  return 'Unknown Player';
}

/**
 * Parse player position from Yahoo API format
 * @param positionObj Yahoo API position object
 * @returns Position string (comma-separated if multiple)
 */
function parsePlayerPosition(positionObj: any): string {
  if (!positionObj) {
    return 'N/A';
  }

  // display_position is a string like "SF,PF"
  if (positionObj.display_position) {
    return positionObj.display_position;
  }

  // eligible_positions is an array of { position: string }
  if (Array.isArray(positionObj.eligible_positions) && positionObj.eligible_positions.length > 0) {
    return positionObj.eligible_positions.map((pos: any) => pos.position).join(',');
  }

  return 'N/A';
}

/**
 * Parse player NBA team from Yahoo API format
 * @param teamObj Yahoo API team object
 * @returns NBA team abbreviation
 */
function parsePlayerNbaTeam(teamObj: any): string {
  if (!teamObj) {
    return 'N/A';
  }

  return teamObj.editorial_team_abbr || teamObj.editorial_team_full_name || 'N/A';
}

/**
 * Parse Player from Yahoo API player data
 * @param playerData Raw Yahoo API player data
 * @returns Player domain model or null if invalid
 */
export function parsePlayer(playerData: YahooApiPlayerData | null | undefined): Player | null {
  if (!playerData || !Array.isArray(playerData[0])) {
    logger.warn('Invalid player data: missing player properties');
    return null;
  }

  const properties = playerData[0];
  if (!Array.isArray(properties) || properties.length === 0) {
    logger.warn('Invalid player data: properties array is empty');
    return null;
  }

  // Find properties in the array
  const nameObj = properties.find((prop: any) => prop.name);
  const positionObj = properties.find((prop: any) => prop.display_position || prop.eligible_positions);
  const statusObj = properties.find((prop: any) => prop.status);
  const teamObj = properties.find((prop: any) => prop.editorial_team_abbr || prop.editorial_team_full_name);
  const playerKeyObj = properties.find((prop: any) => prop.player_key);

  if (!playerKeyObj?.player_key) {
    logger.warn('Invalid player data: player_key not found');
    return null;
  }

  try {
    return {
      playerKey: playerKeyObj.player_key,
      name: parsePlayerName(nameObj?.name),
      position: parsePlayerPosition(positionObj),
      nbaTeam: parsePlayerNbaTeam(teamObj),
      status: parsePlayerStatus(statusObj?.status),
    };
  } catch (error: any) {
    logger.error('Error parsing player:', { error: error.message, playerKey: playerKeyObj.player_key });
    return null;
  }
}

/**
 * Parse multiple players from roster response
 * @param rosterData Raw Yahoo API roster data
 * @returns Array of Player domain models
 */
export function parsePlayersFromRoster(rosterData: any): Player[] {
  if (!rosterData?.roster || !Array.isArray(rosterData.roster) || rosterData.roster.length === 0) {
    logger.warn('Invalid roster data: missing or empty roster');
    return [];
  }

  const playersData = rosterData.roster[0]?.players;
  if (!playersData || !playersData.count) {
    logger.warn('Invalid roster data: missing players or count');
    return [];
  }

  const parsedPlayers: Player[] = [];

  for (let i = 0; i < playersData.count; i++) {
    const playerData = playersData[i.toString()]?.player;
    if (playerData) {
      const player = parsePlayer(playerData);
      if (player) {
        parsedPlayers.push(player);
      }
    }
  }

  return parsedPlayers;
}

