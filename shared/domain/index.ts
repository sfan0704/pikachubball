/**
 * Domain Models Barrel Export
 * Types only - no runtime code
 */

export type { League, Team, ScoringType } from './league';
export type { Player, PlayerStatus } from './player';
export type { Matchup, MatchupStatus, MatchupScore } from './matchup';
export type { 
  TeamStats, 
  PlayerStats, 
  CategoryStats, 
  CategoryKey, 
  StatScope 
} from './stats';

export { CATEGORIES } from './stats';

