/**
 * Domain models and pure fantasy rules. No I/O, clock or framework imports.
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

export type {
  CategoryDirection,
  LeagueCategory,
  LeagueSettings,
  TeamTotals,
  TeamRow,
  MatchupPairing,
  Scope,
  TeamTable,
} from './team-table';
export {
  CATEGORY_DIRECTIONS,
  percentage,
  categoryValue,
  competitionRanks,
  categoryRanks,
  rankSum,
  scoringSupport,
} from './fantasy-rules';
export type { CategoryRanks, ScoringSupport } from './fantasy-rules';
