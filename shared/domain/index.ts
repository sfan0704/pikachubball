/**
 * Domain models and pure fantasy rules. No I/O, clock or framework imports.
 */

export type { CategoryEntry, CategoryValues, RatioParts, StatTotals } from "./categories";
export {
  categoryEntry,
  categoryParts,
  categoryTotal,
  categoryTotals,
  isPercentage,
  partsOfAll,
} from "./categories";

export type {
  CategoryDirection,
  CategoryMakeup,
  LeagueCategory,
  LeagueSettings,
  TeamRecord,
  TeamRow,
  WeekGames,
  MatchupPairing,
  Scope,
  TeamTable,
} from "./team-table";
export {
  percentage,
  competitionRanks,
  categoryRanks,
  scoringSupport,
  tableCompleteness,
} from "./fantasy-rules";
export type { CategoryRanks, ScoringSupport, TableCompleteness } from "./fantasy-rules";
export { compareCategories, opponentOf } from "./views";
export type { CategoryResult, CategoryComparison, Score, TotalsComparison } from "./views";
export type {
  Appearance,
  CountValue,
  Measured,
  MissingKind,
  MissingValue,
  StatLine,
  StatValue,
} from "./stat-value";
export {
  appearance,
  lineOf,
  lineWithGame,
  measured,
  missing,
  missingLine,
  statOf,
  sumLines,
} from "./stat-value";
export type { GameState, LiveProgress } from "./game-state";
export { isLive } from "./game-state";
export type { GamesPlayed, PeriodTotals, PlayerDay, VersusAverage } from "./daily-stats";
export {
  averageThreshold,
  countedGames,
  countedTotals,
  gamesPlayed,
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
export type { ColumnPlayer } from "./matchup-day";
export { closestLostCategory, dayCallout, orderForCategory } from "./matchup-day";
export type { WeekBounds, WeekGroup, WeekPlayer } from "./matchup-week";
export {
  countedGamesLabel,
  elapsedDates,
  orderWeekPlayers,
  weekParts,
  weekPlayers,
  weekValue,
} from "./matchup-week";
export type { ScheduleContext, ScheduledGame, TeamSchedule, WeekDay } from "./nba-schedule";
export { localDateOf, scheduleByTeam, teamSchedule } from "./nba-schedule";
export type { SeasonWeeks } from "./season-weeks";
export { seasonWeekScopes } from "./season-weeks";
export type {
  AllPlayRecord,
  AllPlayTable,
  LuckSteps,
  ScoringCategory,
  TeamCategoryValues,
} from "./all-play";
export {
  addRecords,
  luckSteps,
  officialWeekRecords,
  resultsPlayed,
  seasonAllPlay,
  weeklyAllPlay,
  winPercentage,
  winPercentageRanks,
} from "./all-play";
