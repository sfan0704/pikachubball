/** The current time, injected so code and tests don't read the system clock directly. */
export interface Clock {
  now(): number;
}

/** The real clock. */
export const systemClock: Clock = { now: () => Date.now() };

/** A clock that always reads `time`, for local runs whose dates must not follow the calendar. */
export function frozenClock(time: number): Clock {
  return { now: () => time };
}
