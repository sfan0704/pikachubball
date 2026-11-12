/**
 * Domain models and pure fantasy rules. No I/O, clock or framework imports.
 */

export type { CategoryKey } from "./stats";

export { CATEGORIES } from "./stats";

export type {
  CategoryDirection,
  LeagueCategory,
  LeagueSettings,
  TeamTotals,
  TeamRecord,
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
export { rankings, compareTotals, opponentOf } from "./views";
export type {
  RankedTeam,
  CategoryResult,
  CategoryComparison,
  Score,
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
export { appearance, measured, missing, missingLine, sumLines } from "./stat-value";
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
export { addDays, datesFrom, daysBetween, mondayOf, nbaDateOf } from "./nba-date";
export type { ClassTimers, DailyDataset, FreshnessClass, LiveSignal } from "./freshness";
export {
  backedOffInterval,
  followsLineup,
  FRESHNESS_POLICY,
  freshnessClass,
  freshnessOf,
  liveSignal,
  MAX_POLL_INTERVAL_MS,
  UNCONFIRMED_LIVE_WINDOW_MS,
} from "./freshness";
export type {
  Acquisition,
  DraftPick,
  DraftResults,
  MovePlace,
  PlayerMove,
  TeamMove,
} from "./acquisition";
export { latestAcquisition } from "./acquisition";
export type { CategoryEntry, ColumnPlayer } from "./matchup-day";
export {
  categoryEntry,
  closestLostCategory,
  dayCallout,
  isShootingCategory,
  orderForCategory,
} from "./matchup-day";
export type { WeekBounds, WeekGroup, WeekPlayer } from "./matchup-week";
export {
  countedGamesLabel,
  elapsedDates,
  orderWeekPlayers,
  weekPlayers,
  weekValue,
} from "./matchup-week";
export type { ScheduleContext, ScheduledGame, TeamSchedule } from "./nba-schedule";
export { localDateOf, scheduleByTeam, teamSchedule } from "./nba-schedule";
