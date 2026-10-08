import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { legacyGet, legacyRequest } from "@/api/http";

export async function apiRequest<T>(url: string, method: string, data?: unknown): Promise<T> {
  return legacyRequest<T>(url, method, data);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  <T>({ on401: unauthorizedBehavior }: { on401: UnauthorizedBehavior }): QueryFunction<T> =>
  async ({ queryKey }) =>
    (await legacyGet(queryKey.join("/") as string, unauthorizedBehavior === "returnNull")) as T;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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
