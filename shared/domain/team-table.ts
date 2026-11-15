/** Whether a higher or a lower total wins a category. */
export type CategoryDirection = "higher" | "lower";

/**
 * How a category is built from player stats, for views the app combines itself
 * (summing days or players). A ratio names the stats on top and bottom, for
 * example makes over attempts. "unavailable" means the app can't tell how the
 * category is built, so only Yahoo's own totals can show it.
 */
export type CategoryMakeup =
  | { readonly kind: "counting" }
  | { readonly kind: "ratio"; readonly topStatId: string; readonly bottomStatId: string }
  | { readonly kind: "unavailable" };

/** A scoring category as the league's settings define it. */
export interface LeagueCategory {
  /** Yahoo's stat id, for example "5" for FG%. */
  readonly statId: string;
  readonly displayName: string;
  readonly direction: CategoryDirection;
  readonly makeup: CategoryMakeup;
}

/** League settings that come with every team table. */
export interface LeagueSettings {
  readonly leagueKey: string;
  readonly name: string;
  readonly season: number;
  /** Yahoo's scoring type: "head" for head-to-head categories. */
  readonly scoringType: string;
  readonly categories: readonly LeagueCategory[];
  readonly startWeek: number;
  readonly endWeek: number;
  readonly currentWeek: number;
  readonly isFinished: boolean;
}

/** A team's games for a week, as Yahoo counts them for starting slots. */
export interface WeekGames {
  readonly remaining: number;
  readonly live: number;
  readonly completed: number;
}

/** A team's season head-to-head record, as Yahoo's standings give it. */
export interface TeamRecord {
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
}

/** One team's row in the table. */
export interface TeamRow {
  readonly teamKey: string;
  readonly teamName: string;
  readonly managerName: string | null;
  /**
   * The team's value in each of the league's scoring categories, keyed by stat
   * id: Yahoo's own, except a ratio is exact makes over attempts when Yahoo
   * sends those. Null when Yahoo sent none (for example a ratio with no attempts).
   */
  readonly categoryValues: Readonly<Record<string, number | null>>;
  /** The week's games for starting slots; null for the season, or when Yahoo's week table didn't say. */
  readonly games: WeekGames | null;
  /** Yahoo's official season record; null in week tables, which don't carry the standings. */
  readonly record: TeamRecord | null;
}

/** Two teams playing each other in a week, with Yahoo's official result when it has one. */
export interface MatchupPairing {
  readonly teamKeys: readonly [string, string];
  /** Yahoo's winner; null while undecided or when the week ended tied. */
  readonly winnerTeamKey: string | null;
  readonly isTied: boolean;
}

/** Which slice of the season a table covers. */
export type Scope = { readonly kind: "season" } | { readonly kind: "week"; readonly week: number };

/** Every team's totals for one league and scope: the input to every view. */
export interface TeamTable {
  readonly scope: Scope;
  readonly settings: LeagueSettings;
  readonly teams: readonly TeamRow[];
  /** Week scopes only; empty for the season. */
  readonly pairings: readonly MatchupPairing[];
  /** When Yahoo returned this data (ISO 8601, UTC). */
  readonly fetchedAt: string;
}
