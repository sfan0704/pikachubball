/**
 * Fantasy dates. Yahoo dates fantasy days in US Eastern time, so "today" is
 * the Eastern date of a moment, and date arithmetic works on YYYY-MM-DD text.
 */

const EASTERN_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** The US Eastern date (YYYY-MM-DD) of a moment given in epoch milliseconds. */
export function nbaDateOf(epochMs: number): string {
  return EASTERN_DATE.format(new Date(epochMs));
}

/** The date `days` after `date` (negative goes back); both YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The Monday on or before `date`, where Yahoo's NBA scoring weeks usually start. */
export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

/** Every date from `from` to `to`, both included, in order; empty when `to` is earlier. */
export function datesFrom(from: string, to: string): string[] {
  return Array.from({ length: Math.max(daysBetween(from, to) + 1, 0) }, (_, i) => addDays(from, i));
}
