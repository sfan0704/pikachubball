import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefreshLeagues } from "@/api/hooks";
import { ErrorScreen } from "./ErrorScreen";

/**
 * Shown when no leagues are stored yet. Looks them up from Yahoo once on its
 * own, and offers to check again if there still are none.
 */
export function LeagueLookup({ onPickLeague }: { onPickLeague: () => void }) {
  const refresh = useRefreshLeagues();
  const asked = useRef(false);

  useEffect(() => {
    if (!asked.current) {
      asked.current = true;
      refresh.mutate();
    }
  }, [refresh]);

  if (refresh.isError) {
    return (
      <ErrorScreen
        error={refresh.error}
        onRetry={() => refresh.mutate()}
        onPickLeague={onPickLeague}
      />
    );
  }
  if (refresh.isPending || !refresh.isSuccess) {
    return (
      <div className="space-y-2" role="status" aria-label="Looking up your leagues">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-4" role="status">
        <p className="text-lg font-medium">No leagues found</p>
        <p className="text-sm text-muted-foreground">
          Yahoo doesn't list any fantasy basketball leagues for this account.
        </p>
        <Button variant="outline" onClick={() => refresh.mutate()}>
          Check Yahoo again
        </Button>
      </CardContent>
    </Card>
  );
}
