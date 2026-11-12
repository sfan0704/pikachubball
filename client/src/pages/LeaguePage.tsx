import { useMe } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectResult } from "@/features/account/useConnectResult";
import { ErrorScreen } from "@/features/league/ErrorScreen";
import { LeagueLookup } from "@/features/league/LeagueLookup";
import { LeagueView } from "@/features/league/LeagueView";
import { pickDefaultLeague } from "@/features/league/selection";
import { useLeagueSelection } from "@/features/league/useLeagueSelection";
import { AppShell } from "@/features/shell/AppShell";

function Loading() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function ConnectYahoo() {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-4">
        <p className="text-lg font-medium">Yahoo connection required</p>
        <p className="text-sm text-muted-foreground">
          Sign in with Yahoo to read your fantasy leagues.
        </p>
        <Button asChild>
          <a href="/api/auth/yahoo">Sign in with Yahoo</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function Body() {
  const league = useLeagueSelection();
  const me = useMe();
  const { status, selection, leagues, screens, select } = league;
  const pickLeague = () => {
    const fallback = pickDefaultLeague(leagues);
    if (fallback) {
      select({ leagueKey: fallback.leagueKey });
    }
  };

  if (status === "error") {
    return <ErrorScreen error={league.error} onRetry={league.retry} onPickLeague={pickLeague} />;
  }
  if (status === "loading") {
    return <Loading />;
  }
  if (me.data && !me.data.yahoo.connected) {
    return <ConnectYahoo />;
  }
  if (status === "no-leagues" || !selection) {
    return <LeagueLookup onPickLeague={pickLeague} />;
  }
  const current = leagues.find((item) => item.leagueKey === selection.leagueKey);
  return current ? (
    <LeagueView
      selection={selection}
      leagues={leagues}
      league={current}
      screens={screens}
      onSelect={select}
      onPickLeague={pickLeague}
    />
  ) : (
    <Loading />
  );
}

/** The one page after sign-in: the app shell around the selected league's screens. */
export default function LeaguePage() {
  useConnectResult();
  return (
    <AppShell>
      <Body />
    </AppShell>
  );
}
