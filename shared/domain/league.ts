/**
 * League and Team Domain Models
 */

export type ScoringType = 'head' | 'roto';

/**
 * League domain model
 */
export interface League {
  leagueKey: string;      // e.g., "466.l.29849"
  name: string;           // e.g., "皮卡丘打籃球 season 3"
  season: number;         // e.g., 2024
  currentWeek: number;    // e.g., 5
  endWeek: number;        // e.g., 22
  scoringType: ScoringType; // 'head' for head-to-head, 'roto' for rotisserie
  numTeams: number;       // e.g., 14
}

/**
 * Team domain model
 */
export interface Team {
  teamKey: string;        // e.g., "466.l.29849.t.10"
  teamName: string;       // e.g., "波逼波逼波波逼波"
  leagueKey: string;      // Foreign key to League
  managerName?: string;   // e.g., "John Doe"
  managerGuid?: string;   // Yahoo user GUID
}

