/**
 * The daily-stats freshness policy: how long each dataset stays fresh and
 * whether it polls. One table, applied by the client's query factory, so no
 * screen sets its own timer.
 */
import type { GameState } from "./game-state";
import { daysBetween } from "./nba-date";

/** How quickly a dataset changes. */
export type FreshnessClass = "live" | "recent" | "daily" | "settled";

const MINUTE_MS = 60_000;

/** The timers for one class. `freshFor` is in milliseconds; `pollEvery` is null when the class never polls. */
export interface ClassTimers {
  readonly freshFor: number;
  readonly pollEvery: number | null;
}

/** The policy table. Changing a timer is a one-line change here. */
export const FRESHNESS_POLICY: Readonly<Record<FreshnessClass, ClassTimers>> = {
  live: { freshFor: 2 * MINUTE_MS, pollEvery: 2 * MINUTE_MS },
  recent: { freshFor: 10 * MINUTE_MS, pollEvery: null },
  daily: { freshFor: 6 * 60 * MINUTE_MS, pollEvery: null },
  settled: { freshFor: Number.POSITIVE_INFINITY, pollEvery: null },
};

/** The longest a rate-limited poll waits before trying again. */
export const MAX_POLL_INTERVAL_MS = 10 * MINUTE_MS;

/**
 * How long a tip-off that has passed without a live flag or a final still
 * counts as live. Yahoo can be slow to flag a game, but a postponed game never
 * gets a final, so the signal can't stay on for it forever.
 */
export const UNCONFIRMED_LIVE_WINDOW_MS = 4 * 60 * MINUTE_MS;

/** A dataset the policy times, with the date or week where its class depends on it. */
export type DailyDataset =
  /** D1. "season" and "current" still change as games are played; earlier weeks don't. */
  | { readonly kind: "weekTable"; readonly scope: "season" | "current" | "past" }
  /** D2, for a US Eastern date (YYYY-MM-DD). */
  | { readonly kind: "teamDay"; readonly date: string }
  | { readonly kind: "gameLogs" }
  | { readonly kind: "playerStats" }
  | { readonly kind: "playerList" }
  | { readonly kind: "schedule" }
  | { readonly kind: "transactions" }
  | { readonly kind: "draft" }
  | { readonly kind: "roster" }
  | { readonly kind: "weeks" };

/** D2's class by how far its date is from today. */
function teamDayClass(date: string, today: string): FreshnessClass {
  const daysAgo = daysBetween(date, today);
  if (daysAgo === 0) {
    return "live";
  }
  // Yesterday and the day before take Yahoo's overnight stat corrections. A
  // future date has no stats, but its lineup can still change.
  if (daysAgo < 0 || daysAgo <= 2) {
    return "recent";
  }
  return "settled";
}

const FIXED_CLASSES = {
  gameLogs: "live",
  playerStats: "daily",
  playerList: "recent",
  schedule: "daily",
  transactions: "recent",
  draft: "settled",
  roster: "recent",
  weeks: "settled",
} as const satisfies Record<string, FreshnessClass>;

/** The class of a dataset; `today` is the US Eastern date now. */
export function freshnessClass(dataset: DailyDataset, today: string): FreshnessClass {
  switch (dataset.kind) {
    case "weekTable":
      return dataset.scope === "past" ? "settled" : "live";
    case "teamDay":
      return teamDayClass(dataset.date, today);
    default:
      return FIXED_CLASSES[dataset.kind];
  }
}

/** The timers a dataset gets now. Live data counts as Recent while no shown game is live. */
export function freshnessOf(dataset: DailyDataset, today: string, gamesLive: boolean): ClassTimers {
  const policyClass = freshnessClass(dataset, today);
  return FRESHNESS_POLICY[policyClass === "live" && !gamesLive ? "recent" : policyClass];
}

/**
 * The poll interval after `rateLimitedPolls` rate-limited polls in a row:
 * doubled each time (2, 4, 8 minutes), never more than ten minutes.
 */
export function backedOffInterval(pollEvery: number, rateLimitedPolls: number): number {
  return Math.min(pollEvery * 2 ** rateLimitedPolls, MAX_POLL_INTERVAL_MS);
}

/** Whether any shown game is live, and when that answer can next change without new data. */
export interface LiveSignal {
  readonly gamesLive: boolean;
  /** Epoch milliseconds of the next shown tip-off or end of an unconfirmed window; null when none is ahead. */
  readonly changesAt: number | null;
}

/** Each game's live status at `now`, and when that status changes on the clock alone. */
function gameSignal(state: GameState, now: number): { live: boolean; changesAt: number | null } {
  if (state.kind === "live") {
    return { live: true, changesAt: null };
  }
  if (state.kind !== "scheduled") {
    return { live: false, changesAt: null };
  }
  const tipOff = Date.parse(state.tipOff);
  const windowEnd = tipOff + UNCONFIRMED_LIVE_WINDOW_MS;
  if (now < tipOff) {
    return { live: false, changesAt: tipOff };
  }
  return now < windowEnd ? { live: true, changesAt: windowEnd } : { live: false, changesAt: null };
}

/**
 * "Games live now" from the game states of the players on screen: a game Yahoo
 * flags live, or a tip-off that has passed without a final.
 */
export function liveSignal(games: Iterable<GameState>, now: number): LiveSignal {
  let gamesLive = false;
  let changesAt: number | null = null;
  for (const state of games) {
    const game = gameSignal(state, now);
    gamesLive ||= game.live;
    if (game.changesAt !== null && (changesAt === null || game.changesAt < changesAt)) {
      changesAt = game.changesAt;
    }
  }
  return { gamesLive, changesAt };
}
