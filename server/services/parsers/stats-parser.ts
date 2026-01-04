/**
 * Stats Parser
 * Transform raw Yahoo API stats responses into domain models
 */

import type { TeamStats, CategoryStats } from '@shared/domain';
import type { YahooApiTeamData, YahooApiScoreboardResponse } from '../../types/yahoo-api.js';
import { YAHOO_STAT_IDS } from '../../types/yahoo-stat-ids.js';
import { logger } from '../../utils/logger.js';

/**
 * Parse CategoryStats from Yahoo API stat map
 * @param statMap Map of stat_id -> value
 * @returns CategoryStats or null if invalid
 */
function parseCategoryStats(statMap: Record<string, string | number>): CategoryStats | null {
  try {
    return {
      fgPct: parseFloat(String(statMap[YAHOO_STAT_IDS.FG_PCT] || '0')) || 0,
      ftPct: parseFloat(String(statMap[YAHOO_STAT_IDS.FT_PCT] || '0')) || 0,
      tpm: parseInt(String(statMap[YAHOO_STAT_IDS.TPM] || '0'), 10) || 0,
      pts: parseInt(String(statMap[YAHOO_STAT_IDS.PTS] || '0'), 10) || 0,
      reb: parseInt(String(statMap[YAHOO_STAT_IDS.REB] || '0'), 10) || 0,
      ast: parseInt(String(statMap[YAHOO_STAT_IDS.AST] || '0'), 10) || 0,
      stl: parseInt(String(statMap[YAHOO_STAT_IDS.STL] || '0'), 10) || 0,
      blk: parseInt(String(statMap[YAHOO_STAT_IDS.BLK] || '0'), 10) || 0,
      to: parseInt(String(statMap[YAHOO_STAT_IDS.TO] || '0'), 10) || 0,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error parsing category stats:', { error: errorMessage });
    return null;
  }
}

/**
 * Parse makes/attempts from Yahoo API format (e.g., "127/298")
 * @param value String value in format "makes/attempts"
 * @returns Object with makes and attempts, or null if invalid
 */
function parseMakesAttempts(value: string | number | undefined): { makes: number; attempts: number } | null {
  if (!value) {
    return { makes: 0, attempts: 0 };
  }

  const parts = String(value).split('/');
  if (parts.length !== 2) {
    return { makes: 0, attempts: 0 };
  }

  const makes = parseInt(parts[0], 10) || 0;
  const attempts = parseInt(parts[1], 10) || 0;

  return { makes, attempts };
}

/**
 * Parse TeamStats from Yahoo API team data
 * @param teamData Raw Yahoo API team data
 * @param scope Stat scope ('season' or 'week')
 * @param week Week number (required if scope is 'week')
 * @returns TeamStats or null if invalid
 */
export function parseTeamStats(
  teamData: YahooApiTeamData | null | undefined,
  scope: 'season' | 'week',
  week?: number
): TeamStats | null {
  if (!teamData || !Array.isArray(teamData[0])) {
    logger.warn('Invalid team data: missing team properties', { scope, week });
    return null;
  }

  const properties = teamData[0];
  if (!Array.isArray(properties) || properties.length === 0) {
    logger.warn('Invalid team data: properties array is empty', { scope, week });
    return null;
  }

  const teamKeyObj = properties.find((prop: { team_key?: string }) => prop.team_key);
  if (!teamKeyObj?.team_key) {
    logger.warn('Invalid team data: team_key not found', { scope, week });
    return null;
  }

  const statsData = teamData[1]?.team_stats;
  if (!statsData || !statsData.stats) {
    logger.warn('Invalid team data: missing team_stats', { teamKey: teamKeyObj.team_key, scope, week });
    return null;
  }

  // Build stat map from Yahoo API structure
  const statMap: Record<string, string | number> = {};
  
  if (Array.isArray(statsData.stats)) {
    statsData.stats.forEach((statWrapper: { stat?: { stat_id: string; value: string | number } }) => {
      if (statWrapper.stat) {
        statMap[statWrapper.stat.stat_id] = statWrapper.stat.value;
      }
    });
  }

  // Parse category stats
  const categoryStats = parseCategoryStats(statMap);
  if (!categoryStats) {
    logger.warn('Failed to parse category stats', { teamKey: teamKeyObj.team_key, scope, week });
    return null;
  }

  // Parse makes/attempts for percentages
  const fgData = parseMakesAttempts(statMap[YAHOO_STAT_IDS.FG_MAKES_ATTEMPTS]);
  const ftData = parseMakesAttempts(statMap[YAHOO_STAT_IDS.FT_MAKES_ATTEMPTS]);

  // Extract team name and manager name from properties
  const teamNameObj = properties.find((prop: any) => prop.name);
  const managersObj = properties.find((prop: any) => prop.managers);
  
  let managerName: string | undefined;
  if (managersObj?.managers && Array.isArray(managersObj.managers)) {
    const manager = managersObj.managers[0]?.manager;
    if (manager && typeof manager === 'object') {
      managerName = manager.nickname;
    }
  }

  try {
    const teamStats: TeamStats = {
      teamKey: teamKeyObj.team_key,
      teamName: teamNameObj?.name,
      managerName,
      scope,
      stats: categoryStats,
      fgMakes: fgData?.makes,
      fgAttempts: fgData?.attempts,
      ftMakes: ftData?.makes,
      ftAttempts: ftData?.attempts,
    };

    if (scope === 'week' && week !== undefined) {
      teamStats.week = week;
    }

    return teamStats;
  } catch (error: any) {
    logger.error('Error parsing team stats:', { error: error.message, teamKey: teamKeyObj.team_key });
    return null;
  }
}

/**
 * Extract and normalize standings from Yahoo API response
 * Handles Yahoo API format variations:
 * - Direct array: [{ teams: {...} }]
 * - Wrapped format: { standings: [{ teams: {...} }] }
 * @param standingsSubresource Raw standings subresource from Yahoo API
 * @returns Normalized standings data with teams, or null if invalid
 */
function extractStandingsData(standingsSubresource: any): { standings: Array<{ teams: any }> } | null {
  if (!standingsSubresource) {
    return null;
  }

  // According to Yahoo API docs, standings can be:
  // 1. Direct array format: [{ teams: {...} }]
  // 2. Wrapped format: { standings: [{ teams: {...} }] }
  if (Array.isArray(standingsSubresource)) {
    // Format 1: Direct array - wrap it for consistency
    return { standings: standingsSubresource };
  } else if (standingsSubresource.standings && Array.isArray(standingsSubresource.standings)) {
    // Format 2: Already wrapped
    return standingsSubresource;
  }

  return null;
}

/**
 * Parse multiple TeamStats from standings response
 * Handles raw Yahoo API responses directly (extracts from league[1].standings)
 * @param standingsResponse Raw Yahoo API standings response OR pre-processed standings data
 * @param scope Stat scope ('season' or 'week')
 * @param week Week number (required if scope is 'week')
 * @returns Array of TeamStats
 */
export function parseTeamStatsFromStandings(
  standingsResponse: any,
  scope: 'season' | 'week',
  week?: number
): TeamStats[] {
  // Handle both raw Yahoo API response and pre-processed data
  let standingsData: any = null;

  // Check if this is a raw Yahoo API response (has fantasy_content.league)
  if (standingsResponse?.fantasy_content?.league) {
    const leagueArray = standingsResponse.fantasy_content.league;
    if (Array.isArray(leagueArray) && leagueArray.length >= 2) {
      const standingsSubresource = leagueArray[1]?.standings;
      standingsData = extractStandingsData(standingsSubresource);
    }
  } else {
    // Assume it's already pre-processed (backwards compatibility)
    standingsData = extractStandingsData(standingsResponse);
  }

  if (!standingsData?.standings || !Array.isArray(standingsData.standings) || standingsData.standings.length === 0) {
    logger.warn('Invalid standings data: missing or empty standings', { scope, week });
    return [];
  }

  const teams = standingsData.standings[0]?.teams;
  if (!teams || !teams.count) {
    logger.warn('Invalid standings data: missing teams or count', { scope, week });
    return [];
  }

  const parsedStats: TeamStats[] = [];

  for (let i = 0; i < teams.count; i++) {
    const teamData = teams[i.toString()]?.team;
    if (teamData) {
      const teamStats = parseTeamStats(teamData, scope, week);
      if (teamStats) {
        parsedStats.push(teamStats);
      }
    }
  }

  return parsedStats;
}

/**
 * Parse multiple TeamStats from scoreboard response
 * Extracts team stats from all matchups in a scoreboard
 * @param scoreboardData Raw Yahoo API scoreboard response
 * @param week Week number
 * @returns Array of TeamStats
 */
export function parseTeamStatsFromScoreboard(
  scoreboardData: YahooApiScoreboardResponse | null | undefined,
  week: number
): TeamStats[] {
  if (!scoreboardData?.fantasy_content?.league) {
    logger.warn('Invalid scoreboard data: missing fantasy_content.league', { week });
    return [];
  }

  const leagueArray = scoreboardData.fantasy_content.league;
  if (!Array.isArray(leagueArray) || leagueArray.length < 2) {
    logger.warn('Invalid scoreboard data: league array invalid', { week });
    return [];
  }

  const scoreboardSubresource = leagueArray[1]?.scoreboard;
  
  // Handle scoreboard structure: can be:
  // 1. Array: [{ matchups: {...} }]
  // 2. Object with numeric key: { "0": { matchups: {...} } }
  // 3. Object with matchups property: { matchups: {...} }
  let matchups: any = null;
  if (Array.isArray(scoreboardSubresource) && scoreboardSubresource.length > 0) {
    matchups = scoreboardSubresource[0]?.matchups;
  } else if (scoreboardSubresource && typeof scoreboardSubresource === 'object') {
    // Check for format 2: { "0": { matchups: {...} } }
    const scoreboardObj = scoreboardSubresource as any;
    if (scoreboardObj['0']?.matchups) {
      matchups = scoreboardObj['0'].matchups;
    } else if (scoreboardObj.matchups) {
      // Format 3: { matchups: {...} }
      matchups = scoreboardObj.matchups;
    }
  }

  if (!matchups) {
    logger.warn('No matchups found in scoreboard', { week });
    return [];
  }

  // Normalize matchups to object format with numeric keys
  let normalizedMatchups: any = null;
  if (Array.isArray(matchups)) {
    normalizedMatchups = { count: matchups.length };
    matchups.forEach((m: any, i: number) => {
      normalizedMatchups[i.toString()] = m;
    });
  } else if (matchups && typeof matchups === 'object' && matchups.count !== undefined) {
    normalizedMatchups = matchups;
  } else {
    logger.warn('Invalid matchups structure', { week });
    return [];
  }

  if (!normalizedMatchups.count) {
    logger.warn('No matchups found in scoreboard', { week });
    return [];
  }

  // Extract teams from matchups and parse stats
  const teamStats: TeamStats[] = [];

  for (let i = 0; i < normalizedMatchups.count; i++) {
    const matchupEntry = normalizedMatchups[i.toString()];
    if (!matchupEntry) continue;

    const matchup = matchupEntry.matchup || matchupEntry;
    if (!matchup) continue;

    // Yahoo API structure from scoreboard: matchup['0'] contains teams
    const teamsData = matchup['0'];
    if (!teamsData || !teamsData.teams) continue;

    const matchupTeams = teamsData.teams;
    if (!matchupTeams || !matchupTeams.count) continue;

    for (let j = 0; j < matchupTeams.count; j++) {
      const teamEntry = matchupTeams[j.toString()];
      if (!teamEntry) continue;

      const teamData = teamEntry.team;
      if (teamData) {
        const stats = parseTeamStats(teamData, 'week', week);
        if (stats) {
          teamStats.push(stats);
        }
      }
    }
  }

  return teamStats;
}

