import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/features/league/ErrorScreen";

interface DatasetStateProps<T> {
  query: UseQueryResult<T>;
  onPickLeague: () => void;
  children: (data: T) => ReactNode;
}

/** One dataset's section: a skeleton while it loads, its error with a retry, then the data. */
export function DatasetState<T>({ query, onPickLeague, children }: DatasetStateProps<T>) {
  if (query.data !== undefined) {
    return <>{children(query.data)}</>;
  }
  if (query.error) {
    return (
      <ErrorScreen
        error={query.error}
        onRetry={() => void query.refetch()}
        onPickLeague={onPickLeague}
      />
    );
  }
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
