import type { FantasyDataSource } from '../fantasy-data-source.js';
import type { MatchupComparisonResponse, CategoryComparison } from '@shared/schema';
import { CATEGORIES, type CategoryKey } from './league-viz.js';

export async function getMatchupComparison(
  dataSource: FantasyDataSource,
  leagueKey: string,
  teamKey: string,
  week?: number,
  opponentTeamKey?: string
): Promise<MatchupComparisonResponse> {
  const settings = await dataSource.getLeagueSettings(leagueKey);
  const leagueData = settings?.fantasy_content?.league?.[0];
  const currentWeek = parseInt(leagueData?.current_week || '1');
  const endWeek = parseInt(leagueData?.end_week || '22');
  
  const effectiveWeek = week || currentWeek;
  
  if (effectiveWeek < 1 || effectiveWeek > endWeek) {
    throw new Error(`Week must be between 1 and ${endWeek}`);
  }

  let myTeam: any = null;
  let opponent: any = null;
  let matchupGamesPlayed: number | undefined;
  let matchupGamesRemaining: number | undefined;

  // Get scoreboard to find teams
  const scoreboard = await dataSource.getLeagueScoreboard(leagueKey, effectiveWeek);
  const matchups = scoreboard?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
  
  if (!matchups || matchups.count === 0) {
    throw new Error('No matchups found for this week');
  }

  // Search scoreboard for my team
  for (let i = 0; i < matchups.count; i++) {
    const matchup = matchups[i.toString()]?.matchup;
    if (matchup && matchup['0']?.teams) {
      // Debug: Log matchup structure for first matchup
      if (i === 0) {
        console.log('Matchup structure keys:', Object.keys(matchup['0']));
        console.log('Full matchup[0]:', JSON.stringify(matchup['0'], null, 2).substring(0, 500));
      }
      
      // Extract games played/remaining from matchup metadata
      if (matchup['0'].games_played !== undefined) {
        matchupGamesPlayed = matchup['0'].games_played;
      }
      if (matchup['0'].games_remaining !== undefined) {
        matchupGamesRemaining = matchup['0'].games_remaining;
      }
      
      const teams = matchup['0'].teams;
      
      for (let j = 0; j < teams.count; j++) {
        const team = teams[j.toString()]?.team;
        if (team && Array.isArray(team)) {
          const teamProperties = team[0];
          const teamKeyObj = teamProperties?.find((prop: any) => prop.team_key);
          const currentTeamKey = teamKeyObj?.team_key;
          
          // Check if this is my team
          if (currentTeamKey === teamKey) {
            myTeam = team;
            
            // If no specific opponent is requested, use the other team in this matchup
            if (!opponentTeamKey) {
              const opponentIndex = j === 0 ? 1 : 0;
              const opponentTeam = teams[opponentIndex.toString()]?.team;
              if (opponentTeam && Array.isArray(opponentTeam)) {
                opponent = opponentTeam;
              }
            }
            break;
          }
        }
      }
      
      if (myTeam) break;
    }
  }
  
  // If a specific opponent was requested, search for it
  if (opponentTeamKey && !opponent) {
    for (let i = 0; i < matchups.count; i++) {
      const matchup = matchups[i.toString()]?.matchup;
      if (matchup && matchup['0']?.teams) {
        const teams = matchup['0'].teams;
        
        for (let j = 0; j < teams.count; j++) {
          const team = teams[j.toString()]?.team;
          if (team && Array.isArray(team)) {
            const teamProperties = team[0];
            const teamKeyObj = teamProperties?.find((prop: any) => prop.team_key);
            const currentTeamKey = teamKeyObj?.team_key;
            
            if (currentTeamKey === opponentTeamKey) {
              opponent = team;
              break;
            }
          }
        }
        
        if (opponent) break;
      }
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

  const myTeamStats = extractTeamStatsFromMatchup(myTeam);
  const opponentStats = extractTeamStatsFromMatchup(opponent);

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
      teamName: myTeamStats.teamName
    },
    opponent: {
      teamKey: opponentStats.teamKey,
      teamName: opponentStats.teamName
    },
    categories,
    score: { wins, losses, ties },
    metadata: {
      scope: 'week',
      week: effectiveWeek,
      currentWeek,
      totalWeeks: endWeek,
      gamesPlayed: matchupGamesPlayed,
      gamesRemaining: matchupGamesRemaining
    }
  };
}

function extractTeamStatsFromMatchup(teamData: any): {
  teamKey: string;
  teamName: string;
  stats: Record<CategoryKey, number>;
  fgMakes: number;
  fgAttempts: number;
  ftMakes: number;
  ftAttempts: number;
} {
  const teamProperties = teamData[0];
  const teamKeyObj = teamProperties?.find((prop: any) => prop.team_key);
  const teamNameObj = teamProperties?.find((prop: any) => prop.name);
  
  const statsData = teamData[1]?.team_stats;
  const stats = statsData?.stats || [];
  const statMap: any = {};
  
  if (Array.isArray(stats)) {
    stats.forEach((statObj: any) => {
      if (statObj.stat) {
        statMap[statObj.stat.stat_id] = statObj.stat.value;
      }
    });
  }
  
  // Parse FG makes/attempts from stat 9004003 (format: "127/298")
  let fgMakes = 0;
  let fgAttempts = 0;
  if (statMap['9004003']) {
    const fgParts = statMap['9004003'].split('/');
    fgMakes = parseInt(fgParts[0]) || 0;
    fgAttempts = parseInt(fgParts[1]) || 0;
  }
  
  // Parse FT makes/attempts from stat 9007006 (format: "76/94")
  let ftMakes = 0;
  let ftAttempts = 0;
  if (statMap['9007006']) {
    const ftParts = statMap['9007006'].split('/');
    ftMakes = parseInt(ftParts[0]) || 0;
    ftAttempts = parseInt(ftParts[1]) || 0;
  }
  
  return {
    teamKey: teamKeyObj?.team_key || '',
    teamName: teamNameObj?.name || '',
    stats: {
      fgPct: parseFloat(statMap['5'] || '0'),
      ftPct: parseFloat(statMap['8'] || '0'),
      tpm: parseInt(statMap['10'] || '0'),
      pts: parseInt(statMap['12'] || '0'),
      reb: parseInt(statMap['15'] || '0'),
      ast: parseInt(statMap['16'] || '0'),
      stl: parseInt(statMap['17'] || '0'),
      blk: parseInt(statMap['18'] || '0'),
      to: parseInt(statMap['19'] || '0'),
    },
    fgMakes,
    fgAttempts,
    ftMakes,
    ftAttempts,
  };
}
