import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { scoringSupport, tableCompleteness, type TeamTable } from "@shared/domain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShellSlot } from "@/features/shell/shell-slots";
import { ErrorScreen } from "./ErrorScreen";
import { formatAge } from "./freshness";

/** The parts of a query a table view needs; any TanStack query result fits. */
export interface TableQuery {
  readonly data: TeamTable | undefined;
  readonly error: unknown;
  readonly isPending: boolean;
  readonly isFetching: boolean;
  refetch(): unknown;
}

interface TableBoundaryProps {
  query: TableQuery;
  /** The current time, so the "updated" label can be tested. */
  now: number;
  onPickLeague: () => void;
  /** Renders the loaded table. Only called when the table can be ranked. */
  children: (table: TeamTable) => ReactNode;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-2" role="status">
        <p className="text-lg font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

function Loaded({
  query,
  now,
  children,
}: Pick<TableBoundaryProps, "query" | "now" | "children"> & {
  query: TableQuery & { data: TeamTable };
}) {
  const { data: table } = query;
  const completeness = tableCompleteness(table);
  return (
    <div className="space-y-4">
      <ShellSlot name="freshness">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-muted-foreground/60" />
          <span data-testid="text-updated">Updated {formatAge(table.fetchedAt, now)}</span>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh from Yahoo"
            className="-my-3 ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </p>
      </ShellSlot>
      {completeness === "partial" && (
        <Alert role="status">
          <AlertTitle>Some numbers are missing</AlertTitle>
          <AlertDescription>
            Yahoo hasn't provided every stat. Anything that depends on a missing number is shown as
            unavailable.
          </AlertDescription>
        </Alert>
      )}
      {children(table)}
    </div>
  );
}

/**
 * Chooses what a table view shows: a skeleton while loading, the screen for
 * each error (above the old data when there is some), a notice for a league
 * the app can't rank or one that hasn't started, and otherwise the table with
 * its age and a refresh button in the header's freshness line. Nothing incomplete or old passes as current.
 */
export function TableBoundary({ query, now, onPickLeague, children }: TableBoundaryProps) {
  const retry = () => query.refetch();
  if (query.data === undefined) {
    if (query.error) {
      return <ErrorScreen error={query.error} onRetry={retry} onPickLeague={onPickLeague} />;
    }
    return (
      <div className="space-y-3" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const support = scoringSupport(query.data.settings);
  if (!support.supported) {
    return (
      <Notice title="This league isn't supported yet">
        {support.reason}. Only head-to-head leagues with the standard nine categories can be ranked.
      </Notice>
    );
  }
  if (tableCompleteness(query.data) === "empty") {
    return (
      <Notice title="No stats yet">This league hasn't started, so there is nothing to rank.</Notice>
    );
  }
  return (
    <>
      {query.error ? (
        <ErrorScreen error={query.error} onRetry={retry} onPickLeague={onPickLeague} inline />
      ) : null}
      <Loaded query={{ ...query, data: query.data }} now={now}>
        {children}
      </Loaded>
    </>
  );
}
