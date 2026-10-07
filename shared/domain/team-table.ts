import type { CategoryKey } from "./stats";

/** Whether a higher or a lower total wins a category. */
export type CategoryDirection = "higher" | "lower";

/** A scoring category as the league's settings define it. */
export interface LeagueCategory {
  /** Yahoo's stat id, for example "5" for FG%. */
  readonly statId: string;
  /** The app's key, or null when the category isn't one of the nine standard ones. */
  readonly key: CategoryKey | null;
  readonly displayName: string;
  readonly direction: CategoryDirection;
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

/**
 * A team's totals for one scope. Null means unknown (absent or invalid in
 * Yahoo's data), which is different from a measured zero.
 */
export interface TeamTotals {
  readonly fgMakes: number | null;
  readonly fgAttempts: number | null;
  readonly ftMakes: number | null;
  readonly ftAttempts: number | null;
  readonly tpm: number | null;
  readonly pts: number | null;
  readonly reb: number | null;
  readonly ast: number | null;
  readonly stl: number | null;
  readonly blk: number | null;
  readonly to: number | null;
}

/** One team's row in the table. */
export interface TeamRow {
  readonly teamKey: string;
  readonly teamName: string;
  readonly managerName: string | null;
  readonly totals: TeamTotals;
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
