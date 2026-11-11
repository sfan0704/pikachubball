import { hashKey, queryOptions, skipToken, type Query, type QueryKey } from "@tanstack/react-query";
import {
  backedOffInterval,
  followsLineup,
  freshnessOf,
  nbaDateOf,
  type DailyDataset,
} from "@shared/domain";
import type { Freshness } from "./freshness";

/** A query that is ready to run: the dataset it reads, for the policy, and how to fetch it. */
export interface FreshRequest<T> {
  readonly dataset: DailyDataset;
  readonly fetch: (signal: AbortSignal) => Promise<T>;
}

/** The policy's timers for a ready request, as TanStack Query options. */
function timerOptions<T>(freshness: Freshness, request: FreshRequest<T>) {
  const { freshFor, pollEvery } = freshnessOf(
    request.dataset,
    nbaDateOf(Date.now()),
    freshness.gamesLive
  );
  return {
    staleTime: freshFor,
    refetchInterval: (query: Query<T, Error, T, QueryKey>) =>
      pollEvery === null
        ? false
        : backedOffInterval(pollEvery, freshness.backoff.streak(query.queryHash)),
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: followsLineup(request.dataset) ? "always" : true,
  } as const;
}

/**
 * The query factory for datasets: the key plus the freshness policy's fresh
 * time and poll interval, so no hook or component sets its own. Stale data
 * refetches when it is shown again or the tab regains focus, and data that
 * follows the lineup refetches on focus even when fresh; polls stop while
 * the tab is hidden. A null request waits until its inputs are chosen.
 */
export function freshQuery<T>(
  freshness: Freshness,
  queryKey: QueryKey,
  request: FreshRequest<T> | null
) {
  return queryOptions<T, Error, T, QueryKey>({
    queryKey,
    queryFn:
      request === null
        ? skipToken
        : ({ signal }) => freshness.backoff.track(hashKey(queryKey), request.fetch(signal)),
    ...(request === null ? {} : timerOptions(freshness, request)),
  });
}
