/** "just now", "5 min ago", "3 h ago", "2 days ago": how old data is, for the "updated" label. */
export function formatAge(fetchedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(fetchedAt)) / 60_000));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** The parts of a query result the freshness label reads; any TanStack query result fits. */
export interface FreshnessSource {
  readonly data: unknown;
  /** When the last successful fetch landed, in epoch milliseconds. */
  readonly dataUpdatedAt: number;
  readonly error: unknown;
}

/**
 * The label for one or more sections: the oldest age among the sections that
 * have data, or a stale label when any of them failed its last refresh. Null
 * while no section has data, since each section shows its own loading or error.
 */
export function freshnessLabel(
  sources: readonly FreshnessSource[],
  now: number
): { readonly text: string; readonly stale: boolean } | null {
  const loaded = sources.filter((source) => source.data !== undefined);
  if (loaded.length === 0) {
    return null;
  }
  const oldest = Math.min(...loaded.map((source) => source.dataUpdatedAt));
  const age = formatAge(new Date(oldest).toISOString(), now);
  const stale = loaded.some((source) => source.error !== null && source.error !== undefined);
  return stale
    ? { text: `Couldn't refresh. Showing data from ${age}`, stale }
    : { text: `Updated ${age}`, stale };
}
