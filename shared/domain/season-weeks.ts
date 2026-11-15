/** The weeks of the season so far, as the season table's settings give them. */
export interface SeasonWeeks {
  readonly startWeek: number;
  readonly currentWeek: number;
}

/**
 * The week scopes that make up the season so far: each finished week by
 * number, then the week in progress as "current". Season all-play and luck
 * add these weeks' tables up; the week in progress counts as it stands.
 */
export function seasonWeekScopes({ startWeek, currentWeek }: SeasonWeeks): (number | "current")[] {
  const finished = Math.max(0, currentWeek - startWeek);
  return [...Array.from({ length: finished }, (_, i) => startWeek + i), "current"];
}
