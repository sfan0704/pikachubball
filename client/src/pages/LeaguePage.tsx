import { LogOut } from "lucide-react";
import { useMe } from "@/api/hooks";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectResult } from "@/features/account/useConnectResult";
import { ErrorScreen } from "@/features/league/ErrorScreen";
import { LeagueLookup } from "@/features/league/LeagueLookup";
import { LeagueView } from "@/features/league/LeagueTabs";
import { pickDefaultLeague } from "@/features/league/selection";
import { useLeagueSelection } from "@/features/league/useLeagueSelection";
import { useAuth } from "@/lib/auth";

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
  const { status, selection, leagues, select } = league;
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
      onSelect={select}
      onPickLeague={pickLeague}
    />
  ) : (
    <Loading />
  );
}

/** The one page after sign-in: header, then the selected league's views. */
export default function LeaguePage() {
  useConnectResult();
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3 md:px-6">
          <h1 className="truncate text-lg md:text-xl font-semibold" data-testid="heading-app-title">
            Fantasy Basketball
          </h1>
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label="Sign out"
              onClick={() => void logout()}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 pb-24">
        <Body />
      </main>
    </div>
  );
}
