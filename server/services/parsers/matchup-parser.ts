/**
 * Matchup Parser
 * Transform raw Yahoo API scoreboard responses into domain models
 */

import type { Matchup, MatchupScore } from '@shared/domain';
import type { YahooApiScoreboardResponse, YahooApiMatchupData, YahooApiMatchupTeam, YahooApiTeamData } from '../../types/yahoo-api.js';
import { logger } from '../../utils/logger.js';

/**
 * Parse matchup score from Yahoo API format
 * @param teamPoints Yahoo API team points object
 * @param teamStats Yahoo API team stats (for category wins/losses)
 * @returns MatchupScore or default score
 */
function parseMatchupScore(
  teamPoints: any,
  teamStats?: any
): MatchupScore {
  // Yahoo API may provide wins/losses/ties in different formats
  // For now, we'll extract from team_points if available, otherwise default
  if (teamPoints?.wins !== undefined && teamPoints?.losses !== undefined) {
    return {
      wins: parseInt(String(teamPoints.wins), 10) || 0,
      losses: parseInt(String(teamPoints.losses), 10) || 0,
      ties: parseInt(String(teamPoints.ties || '0'), 10) || 0,
    };
  }

  // Default if not available
  return { wins: 0, losses: 0, ties: 0 };
}

/**
 * Parse matchup status from Yahoo API format
 * @param status Yahoo API status string
 * @returns MatchupStatus
 */
function parseMatchupStatus(status: string | undefined): 'completed' | 'live' | 'upcoming' {
  if (!status) {
    return 'upcoming';
  }

  const statusLower = status.toLowerCase();
  if (statusLower === 'postevent' || statusLower === 'post') {
    return 'completed';
  }
  if (statusLower === 'live' || statusLower === 'inprogress') {
    return 'live';
  }
  return 'upcoming';
}

/**
 * Parse Matchup from Yahoo API matchup data
 * @param matchupData Raw Yahoo API matchup data
 * @param leagueKey League key for the matchup
 * @param week Week number
 * @returns Matchup or null if invalid
 */
export function parseMatchup(
  matchupData: YahooApiMatchupData | null | undefined,
  leagueKey: string,
  week: number
): Matchup | null {
  if (!matchupData) {
    logger.warn('Invalid matchup data: missing matchup', { leagueKey, week });
    return null;
  }

  const properties = matchupData[0];
  const subresources = matchupData[1];

  if (!subresources?.teams) {
    logger.warn('Invalid matchup data: missing teams', { leagueKey, week });
    return null;
  }

  // Extract team data (Yahoo API uses indexed teams: "0", "1")
  const team0Raw = subresources.teams['0'];
  const team1Raw = subresources.teams['1'];

  // Type guard: ensure we have YahooApiMatchupTeam objects, not numbers
  if (!team0Raw || typeof team0Raw === 'number' || !team0Raw.team) {
    logger.warn('Invalid matchup data: missing team 0 data', { leagueKey, week });
    return null;
  }
  if (!team1Raw || typeof team1Raw === 'number' || !team1Raw.team) {
    logger.warn('Invalid matchup data: missing team 1 data', { leagueKey, week });
    return null;
  }

  const team0 = team0Raw;
  const team1 = team1Raw;

  // Extract team keys from team properties
  const team0Props = team0.team[0];
  const team1Props = team1.team[0];

  if (!Array.isArray(team0Props) || !Array.isArray(team1Props)) {
    logger.warn('Invalid matchup data: team properties not arrays', { leagueKey, week });
    return null;
  }

  const team0KeyObj = team0Props.find((prop: any) => prop.team_key);
  const team1KeyObj = team1Props.find((prop: any) => prop.team_key);

  if (!team0KeyObj?.team_key || !team1KeyObj?.team_key) {
    logger.warn('Invalid matchup data: missing team keys', { leagueKey, week });
    return null;
  }

  const team1Key = team0KeyObj.team_key;
  const team2Key = team1KeyObj.team_key;

  // Parse scores
  const team1Score = parseMatchupScore(team0.team_points, team0.team_stats);
  const team2Score = parseMatchupScore(team1.team_points, team1.team_stats);

  // Parse status
  // properties can be an array or object, handle both cases
  let statusValue: string | undefined;
  if (Array.isArray(properties) && properties.length > 0) {
    statusValue = properties[0]?.status;
  } else if (properties && typeof properties === 'object' && 'status' in properties) {
    statusValue = (properties as any).status;
  }
  const status = parseMatchupStatus(statusValue);

  try {
    return {
      leagueKey,
      week,
      team1Key,
      team2Key,
      team1Score,
      team2Score,
      status,
    };
  } catch (error: any) {
    logger.error('Error parsing matchup:', { error: error.message, leagueKey, week });
    return null;
  }
}

/**
 * Extract and normalize matchups from Yahoo API scoreboard structure
 * Handles all Yahoo API format variations:
 * - Array format: [{ matchups: {...} }]
 * - Object with numeric key: { "0": { matchups: {...} } }
 * - Object with matchups property: { matchups: {...} }
 * @param scoreboardSubresource Raw scoreboard subresource from Yahoo API
 * @returns Normalized matchups object with numeric keys, or null if invalid
 */
function extractMatchupsFromScoreboard(scoreboardSubresource: any): { count: number; [key: string]: any } | null {
  if (!scoreboardSubresource) {
    return null;
  }

  // Handle scoreboard structure: can be:
  // 1. Array: [{ matchups: {...} }]
  // 2. Object with numeric key: { "0": { matchups: {...} } }
  // 3. Object with matchups property: { matchups: {...} }
  let matchups: any = null;
  if (Array.isArray(scoreboardSubresource) && scoreboardSubresource.length > 0) {
    // Format 1: Array - get first element's matchups
    matchups = scoreboardSubresource[0]?.matchups;
  } else if (scoreboardSubresource && typeof scoreboardSubresource === 'object') {
    // Check for format 2: { "0": { matchups: {...} } }
    if (scoreboardSubresource['0']?.matchups) {
      matchups = scoreboardSubresource['0'].matchups;
    } else if (scoreboardSubresource.matchups) {
      // Format 3: { matchups: {...} }
      matchups = scoreboardSubresource.matchups;
    }
  }

  if (!matchups) {
    return null;
  }

  // Normalize matchups to object format with numeric keys
  if (Array.isArray(matchups)) {
    const normalized: any = { count: matchups.length };
    matchups.forEach((m: any, i: number) => {
      normalized[i.toString()] = m;
    });
    return normalized;
  } else if (matchups && typeof matchups === 'object' && matchups.count !== undefined) {
    // Already in object format with count
    return matchups;
  }

  return null;
}

/**
 * Extract team data from matchup entry
 * Handles Yahoo API structure: matchup['0'] contains teams
 * @param matchupEntry Matchup entry from normalized matchups
 * @returns Team data array or null if invalid
 */
function extractTeamsFromMatchup(matchupEntry: any): YahooApiTeamData[] | null {
  if (!matchupEntry) {
    return null;
  }

  // Extract matchup data - can be nested in matchup property or direct
  const matchup = matchupEntry.matchup || matchupEntry;
  if (!matchup) {
    return null;
  }

  // Yahoo API structure from scoreboard: matchup['0'] contains teams
  // matchup['0'] = { teams: { count: 2, "0": { team: [...] }, "1": { team: [...] } } }
  const teamsData = matchup['0'];
  if (!teamsData || !teamsData.teams) {
    return null;
  }

  const teams = teamsData.teams;
  if (!teams || !teams.count) {
    return null;
  }

  const teamArray: YahooApiTeamData[] = [];
  for (let j = 0; j < teams.count; j++) {
    const teamEntry = teams[j.toString()];
    if (!teamEntry) continue;

    const team = teamEntry.team;
    if (!team || !Array.isArray(team)) continue;

    teamArray.push(team as unknown as YahooApiTeamData);
  }

  return teamArray.length > 0 ? teamArray : null;
}

/**
 * Parse multiple matchups from scoreboard response
 * Handles all Yahoo API format variations for scoreboard structure
 * @param scoreboardData Raw Yahoo API scoreboard response
 * @param leagueKey League key
 * @param week Week number
 * @returns Array of Matchup domain models
 */
export function parseMatchupsFromScoreboard(
  scoreboardData: YahooApiScoreboardResponse | null | undefined,
  leagueKey: string,
  week: number
): Matchup[] {
  if (!scoreboardData?.fantasy_content?.league) {
    logger.warn('Invalid scoreboard data: missing fantasy_content.league', { leagueKey, week });
    return [];
  }

  const leagueArray = scoreboardData.fantasy_content.league;
  if (!Array.isArray(leagueArray) || leagueArray.length < 2) {
    logger.warn('Invalid scoreboard data: league array invalid', { leagueKey, week });
    return [];
  }

  const scoreboardSubresource = leagueArray[1]?.scoreboard;
  const normalizedMatchups = extractMatchupsFromScoreboard(scoreboardSubresource);

  if (!normalizedMatchups || !normalizedMatchups.count || normalizedMatchups.count === 0) {
    logger.warn('Invalid scoreboard data: missing or invalid matchups', { leagueKey, week });
    return [];
  }

  const parsedMatchups: Matchup[] = [];

  for (let i = 0; i < normalizedMatchups.count; i++) {
    const matchupEntry = normalizedMatchups[i.toString()];
    if (!matchupEntry) continue;

    // Extract matchup data - can be nested in matchup property or direct
    const matchup = matchupEntry.matchup || matchupEntry;
    if (!matchup) continue;

    // Try to parse as YahooApiMatchupData format (array with [0] = properties, [1] = subresources)
    if (Array.isArray(matchup) && matchup.length >= 2) {
      const parsed = parseMatchup(matchup as YahooApiMatchupData, leagueKey, week);
      if (parsed) {
        parsedMatchups.push(parsed);
      }
    } else {
      // Fallback: try to extract teams and create matchup manually
      const teams = extractTeamsFromMatchup(matchupEntry);
      if (teams && teams.length >= 2) {
        // Extract team keys from team properties
        const team0Props = teams[0][0];
        const team1Props = teams[1][0];

        if (Array.isArray(team0Props) && Array.isArray(team1Props)) {
          const team0KeyObj = team0Props.find((prop: any) => prop.team_key);
          const team1KeyObj = team1Props.find((prop: any) => prop.team_key);

          if (team0KeyObj?.team_key && team1KeyObj?.team_key) {
            // Create a basic matchup - scores will be parsed from team data if available
            const team0Subresources = teams[0][1] as any;
            const team1Subresources = teams[1][1] as any;
            const team0Points = team0Subresources?.team_points;
            const team1Points = team1Subresources?.team_points;
            const team0Stats = team0Subresources?.team_stats;
            const team1Stats = team1Subresources?.team_stats;

            parsedMatchups.push({
              leagueKey,
              week,
              team1Key: team0KeyObj.team_key,
              team2Key: team1KeyObj.team_key,
              team1Score: parseMatchupScore(team0Points, team0Stats),
              team2Score: parseMatchupScore(team1Points, team1Stats),
              status: 'upcoming', // Default, can be enhanced if status is available
            });
          }
        }
      }
    }
  }

  return parsedMatchups;
}

/**
 * Extract team data from scoreboard for a specific team key
 * Used by viz services to find specific teams in matchups
 * @param scoreboardData Raw Yahoo API scoreboard response
 * @param teamKey Team key to find
 * @param week Week number
 * @returns Team data if found, null otherwise
 */
export function extractTeamFromScoreboard(
  scoreboardData: YahooApiScoreboardResponse | null | undefined,
  teamKey: string,
  week: number
): YahooApiTeamData | null {
  if (!scoreboardData?.fantasy_content?.league) {
    return null;
  }

  const leagueArray = scoreboardData.fantasy_content.league;
  if (!Array.isArray(leagueArray) || leagueArray.length < 2) {
    return null;
  }

  const scoreboardSubresource = leagueArray[1]?.scoreboard;
  const normalizedMatchups = extractMatchupsFromScoreboard(scoreboardSubresource);

  if (!normalizedMatchups || !normalizedMatchups.count) {
    return null;
  }

  // Search through matchups for the team
  for (let i = 0; i < normalizedMatchups.count; i++) {
    const matchupEntry = normalizedMatchups[i.toString()];
    const teams = extractTeamsFromMatchup(matchupEntry);

    if (teams) {
      for (const team of teams) {
        if (!Array.isArray(team) || team.length === 0) continue;

        const teamProperties = team[0];
        if (!Array.isArray(teamProperties)) continue;

        const teamKeyObj = teamProperties.find((prop: { team_key?: string }) => prop.team_key);
        if (teamKeyObj?.team_key === teamKey) {
          return team as YahooApiTeamData;
        }
      }
    }
  }

  return null;
}

