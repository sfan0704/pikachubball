import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/features/league/ErrorScreen";

/** What a section needs from its dataset: one query, or several read as one. */
export interface DatasetQuery<T> {
  readonly data: T | undefined;
  readonly error: Error | null;
  readonly refetch: () => Promise<unknown>;
}

interface DatasetStateProps<T> {
  query: DatasetQuery<T>;
  onPickLeague: () => void;
  /** What shows while the dataset loads, when a section needs its own shape; a skeleton otherwise. */
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * One dataset's section: a skeleton while it loads, its error with a retry,
 * then the data. A failed refresh keeps the last values under its error.
 */
export function DatasetState<T>({ query, onPickLeague, loading, children }: DatasetStateProps<T>) {
  if (query.data !== undefined) {
    return (
      <>
        {query.error && (
          <ErrorScreen
            inline
            error={query.error}
            onRetry={() => void query.refetch()}
            onPickLeague={onPickLeague}
          />
        )}
        {children(query.data)}
      </>
    );
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
  if (loading !== undefined) {
    return loading;
  }
  return (
    <div className="min-w-0 space-y-2" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-48 max-w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
