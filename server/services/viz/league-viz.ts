import type { FantasyDataSource } from '../fantasy-data-source.js';
import type { RankingsResponse, LeagueHeatmapResponse, TeamHeatmapData, HeatmapCell } from '@shared/schema';

export const CATEGORIES = ['fgPct', 'ftPct', 'tpm', 'pts', 'reb', 'ast', 'stl', 'blk', 'to'] as const;
export type CategoryKey = typeof CATEGORIES[number];

export interface TeamStats {
  teamKey: string;
  teamName: string;
  managerName?: string;
  stats: Record<CategoryKey, number>;
  fgMakes?: number;
  fgAttempts?: number;
  ftMakes?: number;
  ftAttempts?: number;
  gamesPlayed?: number;
  gamesRemaining?: number;
}

export async function getLeagueRankings(
  dataSource: FantasyDataSource,
  leagueKey: string,
  week?: number
): Promise<RankingsResponse> {
  const settings = await dataSource.getLeagueSettings(leagueKey);
  const leagueData = settings?.fantasy_content?.league?.[0];
  const currentWeek = parseInt(leagueData?.current_week || '1');
  const endWeek = parseInt(leagueData?.end_week || '22');
  
  const teamStats = await extractTeamStats(dataSource, leagueKey, week, currentWeek, endWeek);
  
  const rankings = teamStats.map(team => ({
    ...team,
    categoryRanks: {} as Record<CategoryKey, number>,
    totalRank: 0
  }));

  CATEGORIES.forEach(cat => {
    const sorted = [...teamStats].sort((a, b) => {
      if (cat === 'to') {
        return a.stats[cat] - b.stats[cat];
      } else {
        return b.stats[cat] - a.stats[cat];
      }
    });

    sorted.forEach((team, index) => {
      const rankingTeam = rankings.find(r => r.teamKey === team.teamKey);
      if (rankingTeam) {
        rankingTeam.categoryRanks[cat] = index + 1;
      }
    });
  });

  rankings.forEach(team => {
    const totalRank = CATEGORIES.reduce((sum, cat) => sum + team.categoryRanks[cat], 0);
    team.totalRank = totalRank / CATEGORIES.length;
  });

  rankings.sort((a, b) => a.totalRank - b.totalRank);

  return {
    rankings,
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
  const currentWeek = parseInt(leagueData?.current_week || '1');
  const endWeek = parseInt(leagueData?.end_week || '22');
  
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
          teamName: team.teamName,
          categories: {} as any
        };
        teams.push(teamData);
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
  currentWeek?: number,
  endWeek?: number
): Promise<TeamStats[]> {
  let teams: any;
  
  if (week !== undefined) {
    const scoreboard = await dataSource.getLeagueScoreboard(leagueKey, week);
    const matchups = scoreboard?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
    
    if (matchups && matchups.count > 0) {
      teams = { count: 0 };
      let teamIndex = 0;
      
      for (let i = 0; i < matchups.count; i++) {
        const matchup = matchups[i.toString()]?.matchup;
        if (matchup && matchup['0']?.teams) {
          const matchupTeams = matchup['0'].teams;
          for (let j = 0; j < matchupTeams.count; j++) {
            const teamData = matchupTeams[j.toString()]?.team;
            if (teamData) {
              teams[teamIndex.toString()] = { team: teamData };
              teamIndex++;
            }
          }
        }
      }
      teams.count = teamIndex;
    }
  } else {
    const standings = await dataSource.getLeagueStandings(leagueKey);
    teams = standings?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
  }

  if (!teams || teams.count === 0) {
    return [];
  }

  const teamStats: TeamStats[] = [];
  
  for (let i = 0; i < teams.count; i++) {
    const teamData = teams[i.toString()]?.team;
    if (teamData && Array.isArray(teamData) && teamData[0] && Array.isArray(teamData[0])) {
      const teamProperties = teamData[0];
      const teamKeyObj = teamProperties.find((prop: any) => prop.team_key);
      const teamNameObj = teamProperties.find((prop: any) => prop.name);
      const managersObj = teamProperties.find((prop: any) => prop.managers);
      
      // Extract manager name from nested managers array
      let managerName: string | undefined;
      if (managersObj?.managers && Array.isArray(managersObj.managers)) {
        const manager = managersObj.managers[0]?.manager;
        if (manager && typeof manager === 'object') {
          managerName = manager.nickname;
        }
      }
      
      let gamesPlayed: number | undefined;
      let gamesRemaining: number | undefined;
      
      // Calculate games based on weekly matchups
      // In Yahoo Fantasy Basketball, games refers to weekly matchups
      if (week !== undefined) {
        // For week view: show that specific week out of total weeks
        gamesPlayed = week;
        gamesRemaining = (endWeek || 22) - (week || 0);
      } else if (currentWeek && endWeek) {
        // For season view: show current week progress
        gamesPlayed = currentWeek;
        gamesRemaining = endWeek - currentWeek;
      }
      
      const statsData = teamData[1]?.team_stats;
      if (statsData) {
        const stats = statsData.stats;
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
        
        teamStats.push({
          teamKey: teamKeyObj?.team_key,
          teamName: teamNameObj?.name,
          managerName,
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
          gamesPlayed,
          gamesRemaining,
        });
      }
    }
  }
  
  return teamStats;
}
