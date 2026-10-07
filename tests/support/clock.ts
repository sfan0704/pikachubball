/** A clock whose time only moves when a test moves it. */
export interface FixedClock {
  now(): number;
  advance(milliseconds: number): void;
  set(isoTime: string): void;
}

/** Creates a fixed clock starting at `isoTime` (UTC). */
export function fixedClock(isoTime = '2026-01-15T12:00:00.000Z'): FixedClock {
  let current = Date.parse(isoTime);
  if (Number.isNaN(current)) {
    throw new Error(`fixedClock: invalid ISO time ${isoTime}`);
  }
  return {
    now: () => current,
    advance: (milliseconds) => {
      current += milliseconds;
    },
    set: (next) => {
      current = Date.parse(next);
    },
  };
}
