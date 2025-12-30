import type { FantasyDataSource } from '../fantasy-data-source.js';
import type { MatchupComparisonResponse, CategoryComparison } from '@shared/schema';
import { CATEGORIES } from './league-viz.js';
import type { YahooApiTeamData } from '../../types/yahoo-api.js';
import { extractTeamFromScoreboard, parseMatchupsFromScoreboard } from '../parsers/matchup-parser.js';
import { parseTeamStats } from '../parsers/stats-parser.js';

export async function getMatchupComparison(
  dataSource: FantasyDataSource,
  leagueKey: string,
  teamKey: string,
  week?: number,
  opponentTeamKey?: string
): Promise<MatchupComparisonResponse> {
  const settings = await dataSource.getLeagueSettings(leagueKey);
  const leagueData = settings?.fantasy_content?.league?.[0];
  // Handle both array and object formats for league properties
  const leagueProps = Array.isArray(leagueData) 
    ? (leagueData.find((p: any) => p.current_week) || leagueData[0]) 
    : leagueData;
  const currentWeek = parseInt((leagueProps as any)?.current_week || '1');
  const endWeek = parseInt((leagueProps as any)?.end_week || '22');
  
  const effectiveWeek = week || currentWeek;
  
  if (effectiveWeek < 1 || effectiveWeek > endWeek) {
    throw new Error(`Week must be between 1 and ${endWeek}`);
  }

  // Get scoreboard to find teams
  const scoreboard = await dataSource.getLeagueScoreboard(leagueKey, effectiveWeek);
  
  // Use parser to extract team data - this handles all Yahoo API format variations
  const myTeam = extractTeamFromScoreboard(scoreboard, teamKey, effectiveWeek);
  
  if (!myTeam) {
    throw new Error('Your team not found in scoreboard');
  }

  let opponent: YahooApiTeamData | null = null;

  // If a specific opponent was requested, find it
  if (opponentTeamKey) {
    opponent = extractTeamFromScoreboard(scoreboard, opponentTeamKey, effectiveWeek);
    if (!opponent) {
      throw new Error(`Opponent team ${opponentTeamKey} not found in this week's matchups`);
    }
  } else {
    // Find opponent from the same matchup as my team
    // We need to find which matchup contains my team, then get the other team
    const matchups = parseMatchupsFromScoreboard(scoreboard, leagueKey, effectiveWeek);
    const myMatchup = matchups.find(m => m.team1Key === teamKey || m.team2Key === teamKey);
    
    if (myMatchup) {
      const opponentKey = myMatchup.team1Key === teamKey ? myMatchup.team2Key : myMatchup.team1Key;
      opponent = extractTeamFromScoreboard(scoreboard, opponentKey, effectiveWeek);
    }
    
    if (!opponent) {
      throw new Error('Opponent team not found in matchup');
    }
  }
  
  if (!myTeam) {
    throw new Error('Your team not found in scoreboard');
  }
  
  if (!opponent) {
    if (opponentTeamKey) {
      throw new Error(`Opponent team ${opponentTeamKey} not found in this week's matchups`);
    } else {
      throw new Error('Opponent team not found in matchup');
    }
  }

  // Use the new parser instead of duplicate logic
  const myTeamStatsResult = parseTeamStats(myTeam, 'week', effectiveWeek);
  const opponentStatsResult = parseTeamStats(opponent, 'week', effectiveWeek);
  
  if (!myTeamStatsResult || !opponentStatsResult) {
    throw new Error('Failed to parse team stats from matchup');
  }
  
  const myTeamStats = myTeamStatsResult;
  const opponentStats = opponentStatsResult;

  const categories: CategoryComparison[] = CATEGORIES.map(cat => {
    const myValue = myTeamStats.stats[cat];
    const oppValue = opponentStats.stats[cat];
    const difference = myValue - oppValue;
    
    let winning: boolean;
    if (cat === 'to') {
      winning = myValue < oppValue;
    } else {
      winning = myValue > oppValue;
    }
    
    const comparison: CategoryComparison = {
      category: cat,
      myTeam: myValue,
      opponent: oppValue,
      difference,
      winning
    };
    
    // Add makes/attempts for FG and FT
    if (cat === 'fgPct') {
      comparison.myTeamMakes = myTeamStats.fgMakes;
      comparison.myTeamAttempts = myTeamStats.fgAttempts;
      comparison.opponentMakes = opponentStats.fgMakes;
      comparison.opponentAttempts = opponentStats.fgAttempts;
    } else if (cat === 'ftPct') {
      comparison.myTeamMakes = myTeamStats.ftMakes;
      comparison.myTeamAttempts = myTeamStats.ftAttempts;
      comparison.opponentMakes = opponentStats.ftMakes;
      comparison.opponentAttempts = opponentStats.ftAttempts;
    }
    
    return comparison;
  });

  let wins = 0;
  let losses = 0;
  let ties = 0;
  
  categories.forEach(cat => {
    if (cat.difference === 0) {
      ties++;
    } else if (cat.winning) {
      wins++;
    } else {
      losses++;
    }
  });

  return {
    myTeam: {
      teamKey: myTeamStats.teamKey,
      teamName: myTeamStats.teamName || 'Unknown Team'
    },
    opponent: {
      teamKey: opponentStats.teamKey,
      teamName: opponentStats.teamName || 'Unknown Team'
    },
    categories,
    score: { wins, losses, ties },
    metadata: {
      scope: 'week',
      week: effectiveWeek,
      currentWeek,
      totalWeeks: endWeek,
    }
  };
}

