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
  WeekGames,
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
export {
  rankings,
  heatmap,
  compareTotals,
  headToHead,
  compareWithAll,
  opponentOf,
  officialResult,
} from "./views";
export type {
  RankedTeam,
  HeatmapCell,
  HeatmapRow,
  CategoryResult,
  CategoryComparison,
  Score,
  HeadToHead,
  OfficialResult,
  TotalsComparison,
} from "./views";
export type {
  Appearance,
  CountValue,
  MakesAttempts,
  Measured,
  MissingKind,
  MissingValue,
  ShotValue,
  StatLine,
  StatValue,
} from "./stat-value";
export { appearance, measured, missing, missingLine } from "./stat-value";
export type { GameState, LiveProgress } from "./game-state";
export { isLive } from "./game-state";
export type {
  CategoryValues,
  GamesLeft,
  PeriodTotals,
  PlayerDay,
  VersusAverage,
} from "./daily-stats";
export {
  averageThreshold,
  countedGames,
  countedTotals,
  expectedOver,
  gamesLeft,
  perGameAverages,
  versusAverage,
} from "./daily-stats";
