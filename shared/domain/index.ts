/**
 * Domain models and pure fantasy rules. No I/O, clock or framework imports.
 */

export type { Player, PlayerStatus } from "./player";
export type { CategoryKey } from "./stats";

export { CATEGORIES } from "./stats";

export type {
  CategoryDirection,
  LeagueCategory,
  LeagueSettings,
  TeamTotals,
  TeamRow,
  MatchupPairing,
  Scope,
  TeamTable,
} from "./team-table";
export {
  CATEGORY_DIRECTIONS,
  percentage,
  categoryValue,
  competitionRanks,
  categoryRanks,
  rankSum,
  scoringSupport,
  tableCompleteness,
} from "./fantasy-rules";
export type { CategoryRanks, ScoringSupport, TableCompleteness } from "./fantasy-rules";
export { rankings, heatmap, headToHead, compareWithAll, opponentOf, officialResult } from "./views";
export type {
  RankedTeam,
  HeatmapCell,
  HeatmapRow,
  CategoryResult,
  CategoryComparison,
  Score,
  HeadToHead,
  OfficialResult,
} from "./views";
