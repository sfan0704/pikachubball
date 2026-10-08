/**
 * League lifecycle classification for discovery. Yahoo sends flags as 1/0,
 * "1"/"0", booleans or "true"/"false" depending on the resource, so every
 * flag goes through yahooFlag rather than a strict `=== 1` check.
 */

export type LeagueStatus = "active" | "preseason" | "finished";

/** Normalizes a Yahoo flag; undefined when absent or unrecognized. */
export function yahooFlag(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  return undefined;
}

function weekNumber(value: unknown): number | undefined {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export interface LeagueLifecycleInput {
  game: { is_game_over?: unknown; is_offseason?: unknown };
  league: {
    is_finished?: unknown;
    current_week?: unknown;
    end_week?: unknown;
    draft_status?: unknown;
    start_date?: unknown;
  };
  /** Today's date as YYYY-MM-DD, compared with Yahoo's start_date. */
  today: string;
}

/**
 * Finished: Yahoo marks the league or its game over, or the current week is
 * past the league's end week. Preseason: not drafted yet, starting later, or
 * the game is in its offseason. Everything else is active.
 */
export function classifyLeague({ game, league, today }: LeagueLifecycleInput): LeagueStatus {
  const currentWeek = weekNumber(league.current_week);
  const endWeek = weekNumber(league.end_week);
  if (
    yahooFlag(league.is_finished) ||
    yahooFlag(game.is_game_over) ||
    (currentWeek !== undefined && endWeek !== undefined && currentWeek > endWeek)
  ) {
    return "finished";
  }
  if (
    league.draft_status === "predraft" ||
    (typeof league.start_date === "string" && league.start_date > today) ||
    yahooFlag(game.is_offseason)
  ) {
    return "preseason";
  }
  return "active";
}
