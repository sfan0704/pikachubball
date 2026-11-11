import { QueryClient } from "@tanstack/react-query";

/**
 * Server data is fetched by the hooks in `api/`, which pass their own query
 * functions. Datasets take their timers from the freshness policy
 * (`api/fresh-query.ts`); anything else is kept for the session and the
 * refresh button fetches it again.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
