import type { FantasyDataSource } from '../fantasy-data-source.js';
import type { RankingsResponse, LeagueHeatmapResponse, TeamHeatmapData } from '@shared/schema';
import { CATEGORIES, type CategoryKey, type TeamStats } from '@shared/domain';
import { parseTeamStatsFromStandings, parseTeamStatsFromScoreboard } from '../parsers/stats-parser.js';
import { computeRankings } from '../parsers/rankings-compute.js';

// Re-export for other services
export { CATEGORIES, type CategoryKey };

export async function getLeagueRankings(
  dataSource: FantasyDataSource,
  leagueKey: string,
  week?: number
): Promise<RankingsResponse> {
  const settings = await dataSource.getLeagueSettings(leagueKey);
  const leagueData = settings?.fantasy_content?.league?.[0];
  // Handle both array and object formats for league properties
  const leagueProps = Array.isArray(leagueData) 
    ? (leagueData.find((p: any) => p.current_week) || leagueData[0]) 
    : leagueData;
  const currentWeek = parseInt((leagueProps as any)?.current_week || '1');
  const endWeek = parseInt((leagueProps as any)?.end_week || '22');
  
  const teamStats = await extractTeamStats(dataSource, leagueKey, week, currentWeek, endWeek);
  
  // Compute rankings using the new computation functions
  const rankings = computeRankings(teamStats);
  
  // Sort by total rank
  rankings.sort((a, b) => (a.totalRank || 0) - (b.totalRank || 0));

  // Convert to DTO format (TeamRanking requires teamName)
  const rankingsDto = rankings.map(team => ({
    teamKey: team.teamKey,
    teamName: team.teamName || 'Unknown Team',
    managerName: team.managerName,
    stats: team.stats,
    categoryRanks: team.categoryRanks || {} as Record<CategoryKey, number>,
    totalRank: team.totalRank || 0,
    // Include makes/attempts data for percentage stats
    fgMakes: team.fgMakes,
    fgAttempts: team.fgAttempts,
    ftMakes: team.ftMakes,
    ftAttempts: team.ftAttempts,
  }));

  return {
    rankings: rankingsDto,
    metadata: {
      scope: week !== undefined ? 'week' : 'season',
      week,
      currentWeek,
      totalWeeks: endWeek
    }
  };
}

export async function getLeagueHeatmap(
  dataSource: FantasyDataSource,
  leagueKey: string,
  week?: number
): Promise<LeagueHeatmapResponse> {
  const settings = await dataSource.getLeagueSettings(leagueKey);
  const leagueData = settings?.fantasy_content?.league?.[0];
  // Handle both array and object formats for league properties
  const leagueProps = Array.isArray(leagueData) 
    ? (leagueData.find((p: any) => p.current_week) || leagueData[0]) 
    : leagueData;
  const currentWeek = parseInt((leagueProps as any)?.current_week || '1');
  const endWeek = parseInt((leagueProps as any)?.end_week || '22');
  
  const teamStats = await extractTeamStats(dataSource, leagueKey, week, currentWeek, endWeek);
  
  const teams: TeamHeatmapData[] = [];
  
  CATEGORIES.forEach(cat => {
    const sorted = [...teamStats].sort((a, b) => {
      if (cat === 'to') {
        return a.stats[cat] - b.stats[cat];
      } else {
        return b.stats[cat] - a.stats[cat];
      }
    });

    sorted.forEach((team, index) => {
      let teamData = teams.find(t => t.teamKey === team.teamKey);
      if (!teamData) {
        teamData = {
          teamKey: team.teamKey,
          teamName: team.teamName || 'Unknown Team',
          categories: {} as any
        };
        teams.push(teamData);
      }
      
      if (!teamData) {
        return; // Type guard
      }
      
      const rank = index + 1;
      const percentile = ((teamStats.length - index) / teamStats.length) * 100;
      
      teamData.categories[cat] = {
        value: team.stats[cat],
        rank,
        percentile
      };
    });
  });

  return {
    teams,
    metadata: {
      scope: week !== undefined ? 'week' : 'season',
      week,
      currentWeek,
      totalWeeks: endWeek
    }
  };
}

async function extractTeamStats(
  dataSource: FantasyDataSource,
  leagueKey: string,
  week?: number,
  _currentWeek?: number,
  _endWeek?: number
): Promise<TeamStats[]> {
  const { logger } = await import("../../utils/logger");
  
  if (week !== undefined) {
    // For weekly stats, get from scoreboard
    const scoreboard = await dataSource.getLeagueScoreboard(leagueKey, week);
    logger.debug("Scoreboard response structure:", {
      leagueKey,
      week,
      hasFantasyContent: !!scoreboard?.fantasy_content,
      leagueArrayLength: scoreboard?.fantasy_content?.league?.length,
    });
    
    // Use parser to extract team stats - this handles all Yahoo API format variations
    return parseTeamStatsFromScoreboard(scoreboard, week);
  } else {
    // For season stats, get from standings
    const standings = await dataSource.getLeagueStandings(leagueKey);
    logger.debug("Standings response structure:", {
      leagueKey,
      hasFantasyContent: !!standings?.fantasy_content,
      leagueArrayLength: standings?.fantasy_content?.league?.length,
      hasStandings: !!standings?.fantasy_content?.league?.[1]?.standings,
    });
    
    // Use parser to extract team stats - this handles all Yahoo API format variations
    // Parser can accept raw Yahoo API response directly
    return parseTeamStatsFromStandings(standings, 'season');
  }
}
