/**
 * Stats Domain Models
 * Statistical performance for teams and players
 */

export type StatScope = 'season' | 'week';

/**
 * The 9 standard fantasy basketball categories
 */
export const CATEGORIES = ['fgPct', 'ftPct', 'tpm', 'pts', 'reb', 'ast', 'stl', 'blk', 'to'] as const;
export type CategoryKey = typeof CATEGORIES[number];

/**
 * Category statistics (the 9 categories)
 */
export interface CategoryStats {
  fgPct: number;   // Field Goal Percentage
  ftPct: number;   // Free Throw Percentage
  tpm: number;     // Three Pointers Made
  pts: number;     // Points
  reb: number;     // Rebounds
  ast: number;     // Assists
  stl: number;     // Steals
  blk: number;     // Blocks
  to: number;       // Turnovers
}

/**
 * Team statistics with time scope
 */
export interface TeamStats {
  teamKey: string;
  teamName?: string;  // Optional, for DTO conversion convenience
  managerName?: string;  // Optional, for DTO conversion convenience
  scope: StatScope;
  week?: number;    // Required if scope is 'week'
  stats: CategoryStats;
  
  // Makes/attempts for percentage calculations
  fgMakes?: number;
  fgAttempts?: number;
  ftMakes?: number;
  ftAttempts?: number;
  
  // Computed rankings (not stored, computed on-demand)
  categoryRanks?: Record<CategoryKey, number>;
  totalRank?: number;
}

/**
 * Player statistics (same structure as team stats)
 */
export interface PlayerStats {
  playerKey: string;
  scope: StatScope;
  week?: number;
  stats: CategoryStats;
}

