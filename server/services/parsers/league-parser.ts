/**
 * League and Team Parsers
 * Transform raw Yahoo API responses into domain models
 */

import type { League, Team } from '@shared/domain';
import type { YahooApiLeagueResponse, YahooApiTeamData, YahooApiLeagueProperties } from '../../types/yahoo-api.js';
import { logger } from '../../utils/logger.js';

/**
 * Parse League from Yahoo API response
 * @param data Raw Yahoo API league response
 * @returns League domain model or null if invalid
 */
export function parseLeague(data: YahooApiLeagueResponse | null | undefined): League | null {
  if (!data?.fantasy_content?.league) {
    logger.warn('Invalid league data: missing fantasy_content.league');
    return null;
  }

  const leagueArray = data.fantasy_content.league;
  if (!Array.isArray(leagueArray) || leagueArray.length < 1) {
    logger.warn('Invalid league data: league array is empty or invalid');
    return null;
  }

  const properties = leagueArray[0];
  
  // Handle both structures:
  // - Array of property objects (some endpoints)
  // - Direct object with properties (settings/standings endpoints)
  let leagueProps: YahooApiLeagueProperties | undefined;
  
  if (Array.isArray(properties)) {
    // Find properties in the array (Yahoo API uses array of objects)
    leagueProps = properties.find((prop: any) => prop.league_key) as YahooApiLeagueProperties | undefined;
  } else if (properties && typeof properties === 'object' && 'league_key' in properties) {
    // Direct object access (settings/standings endpoints)
    leagueProps = properties as YahooApiLeagueProperties;
  }
  
  if (!leagueProps) {
    logger.warn('Invalid league data: league_key not found in properties');
    return null;
  }

  try {
    return {
      leagueKey: leagueProps.league_key || '',
      name: leagueProps.name || 'Unknown League',
      season: parseInt(leagueProps.season || '0', 10) || 0,
      currentWeek: parseInt(leagueProps.current_week || '1', 10) || 1,
      endWeek: parseInt(leagueProps.end_week || '22', 10) || 22,
      scoringType: (leagueProps.scoring_type === 'head' ? 'head' : 'roto') as 'head' | 'roto',
      numTeams: parseInt(leagueProps.num_teams || '0', 10) || 0,
    };
  } catch (error: any) {
    logger.error('Error parsing league:', { error: error.message, leagueProps });
    return null;
  }
}

/**
 * Parse Team from Yahoo API team data structure
 * @param teamData Raw Yahoo API team data
 * @param leagueKey League key for the team
 * @returns Team domain model or null if invalid
 */
export function parseTeam(teamData: YahooApiTeamData | null | undefined, leagueKey: string): Team | null {
  if (!teamData || !Array.isArray(teamData[0])) {
    logger.warn('Invalid team data: missing team properties', { leagueKey });
    return null;
  }

  const properties = teamData[0];
  if (!Array.isArray(properties) || properties.length === 0) {
    logger.warn('Invalid team data: properties array is empty', { leagueKey });
    return null;
  }

  // Find properties in the array
  const teamKeyObj = properties.find((prop: any) => prop.team_key);
  const teamNameObj = properties.find((prop: any) => prop.name);
  const managersObj = properties.find((prop: any) => prop.managers);

  if (!teamKeyObj?.team_key) {
    logger.warn('Invalid team data: team_key not found', { leagueKey });
    return null;
  }

  // Extract manager name from nested managers array
  let managerName: string | undefined;
  let managerGuid: string | undefined;

  if (managersObj?.managers && Array.isArray(managersObj.managers)) {
    const manager = managersObj.managers[0]?.manager;
    if (manager && typeof manager === 'object') {
      managerName = manager.nickname;
      managerGuid = manager.guid;
    }
  }

  try {
    return {
      teamKey: teamKeyObj.team_key,
      teamName: teamNameObj?.name || 'Unknown Team',
      leagueKey,
      managerName,
      managerGuid,
    };
  } catch (error: any) {
    logger.error('Error parsing team:', { error: error.message, teamKey: teamKeyObj.team_key });
    return null;
  }
}

/**
 * Parse multiple teams from standings response
 * @param standingsData Raw Yahoo API standings data
 * @param leagueKey League key for the teams
 * @returns Array of Team domain models
 */
export function parseTeamsFromStandings(
  standingsData: any,
  leagueKey: string
): Team[] {
  if (!standingsData?.standings || !Array.isArray(standingsData.standings) || standingsData.standings.length === 0) {
    logger.warn('Invalid standings data: missing or empty standings', { leagueKey });
    return [];
  }

  const teams = standingsData.standings[0]?.teams;
  if (!teams || !teams.count) {
    logger.warn('Invalid standings data: missing teams or count', { leagueKey });
    return [];
  }

  const parsedTeams: Team[] = [];

  for (let i = 0; i < teams.count; i++) {
    const teamData = teams[i.toString()]?.team;
    if (teamData) {
      const team = parseTeam(teamData, leagueKey);
      if (team) {
        parsedTeams.push(team);
      }
    }
  }

  return parsedTeams;
}

