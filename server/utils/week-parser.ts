/**
 * Utility to parse and validate week parameter from query string
 */
export function parseWeekParam(weekParam: unknown): number | undefined {
  if (!weekParam) {
    return undefined;
  }

  const parsed = parseInt(String(weekParam), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

