import type { FantasyDataSource } from '../fantasy-data-source.js';
import type { ScheduleMatrixResponse, DaySchedule, PlayerGame } from '@shared/schema';

export async function getScheduleMatrix(
  dataSource: FantasyDataSource,
  leagueKey: string,
  teamKey: string,
  week?: number,
  opponentTeamKey?: string
): Promise<ScheduleMatrixResponse> {
  const settings = await dataSource.getLeagueSettings(leagueKey);
  const leagueData = settings?.fantasy_content?.league?.[0];
  const currentWeek = parseInt(leagueData?.current_week || '1');
  const endWeek = parseInt(leagueData?.end_week || '22');
  
  const effectiveWeek = week || currentWeek;
  
  if (effectiveWeek < 1 || effectiveWeek > endWeek) {
    throw new Error(`Week must be between 1 and ${endWeek}`);
  }

  const myRoster = await dataSource.getTeamRoster(teamKey);
  const myTeamData = extractTeamInfo(myRoster);
  const myPlayers = extractRosterPlayers(myRoster);
  
  const mySchedule = await generateScheduleForWeek(myPlayers, effectiveWeek);
  const myTotalGames = mySchedule.reduce((sum, day) => sum + day.gameCount, 0);

  let opponentData;
  if (opponentTeamKey) {
    const oppRoster = await dataSource.getTeamRoster(opponentTeamKey);
    const oppTeamData = extractTeamInfo(oppRoster);
    const oppPlayers = extractRosterPlayers(oppRoster);
    const oppSchedule = await generateScheduleForWeek(oppPlayers, effectiveWeek);
    const oppTotalGames = oppSchedule.reduce((sum, day) => sum + day.gameCount, 0);
    
    opponentData = {
      teamKey: opponentTeamKey,
      teamName: oppTeamData.teamName,
      schedule: oppSchedule,
      totalGames: oppTotalGames
    };
  }

  return {
    myTeam: {
      teamKey,
      teamName: myTeamData.teamName,
      schedule: mySchedule,
      totalGames: myTotalGames
    },
    opponent: opponentData,
    metadata: {
      scope: 'week',
      week: effectiveWeek,
      currentWeek,
      totalWeeks: endWeek
    },
    isPlaceholder: true,
    placeholderMessage: 'NBA game schedule data requires external API integration. This feature is currently unavailable.'
  };
}

function extractTeamInfo(rosterData: any): { teamKey: string; teamName: string } {
  const team = rosterData?.fantasy_content?.team;
  if (!team || !Array.isArray(team)) {
    return { teamKey: '', teamName: 'Unknown Team' };
  }
  
  const teamProperties = team[0];
  if (!Array.isArray(teamProperties)) {
    return { teamKey: '', teamName: 'Unknown Team' };
  }
  
  const teamKeyObj = teamProperties.find((prop: any) => prop.team_key);
  const teamNameObj = teamProperties.find((prop: any) => prop.name);
  
  return {
    teamKey: teamKeyObj?.team_key || '',
    teamName: teamNameObj?.name || 'Unknown Team'
  };
}

function extractRosterPlayers(rosterData: any): Array<{
  playerKey: string;
  playerName: string;
  team: string;
}> {
  const roster = rosterData?.fantasy_content?.team?.[1]?.roster?.[0]?.players;
  if (!roster || !roster.count) {
    return [];
  }

  const players: Array<{ playerKey: string; playerName: string; team: string }> = [];
  
  for (let i = 0; i < roster.count; i++) {
    const playerData = roster[i.toString()]?.player;
    if (playerData && Array.isArray(playerData)) {
      const playerInfo = playerData[0];
      if (Array.isArray(playerInfo)) {
        const playerKeyObj = playerInfo.find((prop: any) => prop.player_key);
        const nameObj = playerInfo.find((prop: any) => prop.name);
        const teamObj = playerInfo.find((prop: any) => prop.editorial_team_abbr);
        
        if (playerKeyObj && nameObj && teamObj) {
          players.push({
            playerKey: playerKeyObj.player_key,
            playerName: nameObj.full || nameObj.name || 'Unknown Player',
            team: teamObj.editorial_team_abbr
          });
        }
      }
    }
  }
  
  return players;
}

async function generateScheduleForWeek(
  players: Array<{ playerKey: string; playerName: string; team: string }>,
  week: number
): Promise<DaySchedule[]> {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const schedule: DaySchedule[] = [];
  
  const startDate = getWeekStartDate(week);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = daysOfWeek[i];
    
    schedule.push({
      date: dateString,
      dayOfWeek,
      games: [],
      gameCount: 0
    });
  }
  
  return schedule;
}

function getWeekStartDate(week: number): Date {
  const seasonStart = new Date('2024-10-21');
  const weekStart = new Date(seasonStart);
  weekStart.setDate(seasonStart.getDate() + (week - 1) * 7);
  return weekStart;
}
