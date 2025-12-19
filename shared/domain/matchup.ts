/**
 * Matchup Domain Model
 */

export type MatchupStatus = 'completed' | 'live' | 'upcoming';

/**
 * Matchup score (W/L/T)
 */
export interface MatchupScore {
  wins: number;
  losses: number;
  ties: number;
}

/**
 * Matchup domain model
 * Represents a head-to-head matchup between two teams in a week
 */
export interface Matchup {
  leagueKey: string;      // Foreign key to League
  week: number;           // Week number
  team1Key: string;        // Foreign key to Team
  team2Key: string;       // Foreign key to Team
  team1Score: MatchupScore;
  team2Score: MatchupScore;
  status: MatchupStatus;  // 'completed', 'live', or 'upcoming'
}

