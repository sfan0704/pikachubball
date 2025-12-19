import type { FantasyDataSource } from '../fantasy-data-source.js';
import type { ScheduleMatrixResponse, DaySchedule, PlayerGame } from '@shared/schema';
import { parseTeam } from '../parsers/league-parser.js';
import { parsePlayersFromRoster } from '../parsers/player-parser.js';
import type { YahooApiTeamResponse } from '../../types/yahoo-api.js';

export async function getScheduleMatrix(
  dataSource: FantasyDataSource,
  leagueKey: string,
  teamKey: string,
  week?: number,
  opponentTeamKey?: string
): Promise<ScheduleMatrixResponse> {
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

  const myRoster = await dataSource.getTeamRoster(teamKey);
  const myTeamData = extractTeamInfo(myRoster, leagueKey);
  const myPlayers = extractRosterPlayers(myRoster);
  
  const mySchedule = await generateScheduleForWeek(myPlayers, effectiveWeek);
  const myTotalGames = mySchedule.reduce((sum, day) => sum + day.gameCount, 0);

  let opponentData: { teamKey: string; teamName: string; schedule: DaySchedule[]; totalGames: number } | undefined;
  if (opponentTeamKey) {
    const oppRoster = await dataSource.getTeamRoster(opponentTeamKey);
    const oppTeamData = extractTeamInfo(oppRoster, leagueKey);
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

function extractTeamInfo(rosterData: YahooApiTeamResponse, leagueKey: string): { teamKey: string; teamName: string } {
  const team = rosterData?.fantasy_content?.team;
  if (!team) {
    return { teamKey: '', teamName: 'Unknown Team' };
  }
  
  // Use the parser for consistency
  const parsedTeam = parseTeam(team, leagueKey);
  if (parsedTeam) {
    return {
      teamKey: parsedTeam.teamKey,
      teamName: parsedTeam.teamName
    };
  }
  
  return { teamKey: '', teamName: 'Unknown Team' };
}

function extractRosterPlayers(rosterData: YahooApiTeamResponse): Array<{
  playerKey: string;
  playerName: string;
  team: string;
}> {
  const roster = rosterData?.fantasy_content?.team?.[1]?.roster;
  if (!roster || !Array.isArray(roster) || roster.length === 0) {
    return [];
  }

  // Use the parser for consistency
  const domainPlayers = parsePlayersFromRoster({ roster });
  
  // Convert to the format needed for schedule (playerName and team instead of name and nbaTeam)
  return domainPlayers.map(player => ({
    playerKey: player.playerKey,
    playerName: player.name,
    team: player.nbaTeam
  }));
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
