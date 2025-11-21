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

  // If a specific opponent is provided, fetch rosters directly
  if (opponentTeamKey) {
    const myRoster = await dataSource.getTeamRoster(leagueKey, teamKey, effectiveWeek);
    const opponentRoster = await dataSource.getTeamRoster(leagueKey, opponentTeamKey, effectiveWeek);
    
    if (!myRoster || !opponentRoster) {
      throw new Error('Could not fetch team rosters');
    }
    
    myTeam = convertRosterToMatchupFormat(myRoster, teamKey);
    opponent = convertRosterToMatchupFormat(opponentRoster, opponentTeamKey);
  } else {
    // Original behavior: get opponent from the scheduled matchup
    const scoreboard = await dataSource.getLeagueScoreboard(leagueKey, effectiveWeek);
    const matchups = scoreboard?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
    
    if (!matchups || matchups.count === 0) {
      throw new Error('No matchups found for this week');
    }

    for (let i = 0; i < matchups.count; i++) {
      const matchup = matchups[i.toString()]?.matchup;
      if (matchup && matchup['0']?.teams) {
        const teams = matchup['0'].teams;
        
        for (let j = 0; j < teams.count; j++) {
          const team = teams[j.toString()]?.team;
          if (team && Array.isArray(team)) {
            const teamProperties = team[0];
            const teamKeyObj = teamProperties?.find((prop: any) => prop.team_key);
            
            if (teamKeyObj?.team_key === teamKey) {
              myTeam = team;
              const opponentIndex = j === 0 ? 1 : 0;
              opponent = teams[opponentIndex.toString()]?.team;
              break;
            }
          }
        }
        
        if (myTeam && opponent) break;
      }
    }
    
    if (!myTeam || !opponent) {
      throw new Error('Team or matchup not found');
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
    
    return {
      category: cat,
      myTeam: myValue,
      opponent: oppValue,
      difference,
      winning
    };
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
      totalWeeks: endWeek
    }
  };
}

function convertRosterToMatchupFormat(rosterData: any, teamKey: string): any {
  const roster = rosterData?.fantasy_content?.roster;
  
  if (!roster) {
    throw new Error('Invalid roster data');
  }

  const coverage_type = roster[0]?.coverage_type;
  const coverage_value = roster[0]?.coverage_value;
  
  // Get team info from roster
  const team = roster[1]?.team;
  let teamName = 'Unknown Team';
  
  if (Array.isArray(team)) {
    const teamProperties = team[0];
    const teamNameObj = teamProperties?.find((prop: any) => prop.name);
    teamName = teamNameObj?.name || 'Unknown Team';
  }

  // Extract players and calculate stats
  const players = roster[1]?.roster?.[0]?.coverage_type === coverage_type ? roster[1]?.roster?.[0]?.players : [];
  let playerCount = 0;
  const statMap: any = {};

  // Initialize stat map
  for (let i = 0; i <= 19; i++) {
    statMap[i.toString()] = 0;
  }

  if (Array.isArray(players) && typeof players === 'object') {
    const playerEntries = Object.values(players).filter((entry: any) => entry && entry.player);
    playerEntries.forEach((entry: any) => {
      const player = entry.player;
      if (Array.isArray(player)) {
        const playerStats = player[1]?.player_stats;
        if (playerStats && playerStats.stats) {
          playerCount++;
          playerStats.stats.forEach((stat: any) => {
            const statId = stat.stat.stat_id.toString();
            const statValue = parseFloat(stat.stat.value) || 0;
            statMap[statId] = (statMap[statId] || 0) + statValue;
          });
        }
      }
    });
  }

  return {
    0: [
      { team_key: teamKey },
      { name: teamName }
    ],
    1: {
      team_stats: {
        stats: [
          { stat: { stat_id: '5', value: (statMap['5'] / playerCount).toString() } },
          { stat: { stat_id: '8', value: (statMap['8'] / playerCount).toString() } },
          { stat: { stat_id: '10', value: statMap['10'].toString() } },
          { stat: { stat_id: '12', value: statMap['12'].toString() } },
          { stat: { stat_id: '15', value: statMap['15'].toString() } },
          { stat: { stat_id: '16', value: statMap['16'].toString() } },
          { stat: { stat_id: '17', value: statMap['17'].toString() } },
          { stat: { stat_id: '18', value: statMap['18'].toString() } },
          { stat: { stat_id: '19', value: statMap['19'].toString() } }
        ]
      }
    }
  };
}

function extractTeamStatsFromMatchup(teamData: any): {
  teamKey: string;
  teamName: string;
  stats: Record<CategoryKey, number>;
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
    }
  };
}
