import { QueryClient } from "@tanstack/react-query";

/**
 * Server data is fetched by the hooks in `api/`, which pass their own query
 * functions. Data is kept for the session; the refresh button fetches again.
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
