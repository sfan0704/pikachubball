import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeagueRankings from "@/components/LeagueRankings";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useLocation, useSearch } from "wouter";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsDialog from "@/components/SettingsDialog";
import type { League, RankingsResponse } from "@shared/schema";

export default function RankingsPage() {
  const [selectedLeagueKey, setSelectedLeagueKey] = useState<string>("");
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  // Parse week from URL query params using useMemo to avoid redundant parsing
  const selectedWeek = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    if (!weekParam) return null;
    
    const parsed = parseInt(weekParam, 10);
    return (Number.isFinite(parsed) && parsed > 0) ? parsed : null;
  }, [searchParams]);

  // Clean up invalid week from URL if needed (runs once per invalid value)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    
    if (weekParam) {
      const parsed = parseInt(weekParam, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        // Invalid week - remove from URL once
        params.delete('week');
        const path = location.split('?')[0];
        const newSearch = params.toString();
        setLocation(`${path}${newSearch ? '?' + newSearch : ''}`, { replace: true });
      }
    }
    // Only run when searchParams changes, not on every render
  }, [searchParams, location, setLocation]);

  const { data: leaguesData, isLoading: isLoadingLeagues } = useQuery<{
    leagues: League[];
  }>({
    queryKey: ["/api/yahoo/leagues"],
    retry: false,
  });

  const leagues = leaguesData?.leagues || [];
  const selectedLeague = leagues.find(l => l.leagueKey === selectedLeagueKey);

  // Build query URL with week parameter
  const rankingsUrl = useMemo(() => {
    if (!selectedLeagueKey) return null;
    return selectedWeek 
      ? `/api/yahoo/league-rankings/${selectedLeagueKey}?week=${selectedWeek}`
      : `/api/yahoo/league-rankings/${selectedLeagueKey}`;
  }, [selectedLeagueKey, selectedWeek]);

  const { data: rankingsData, isLoading: isLoadingRankings } = useQuery<RankingsResponse>({
    queryKey: [rankingsUrl],
    enabled: !!rankingsUrl,
    retry: false,
  });

  const rankings = rankingsData?.rankings || [];
  const metadata = rankingsData?.metadata;

  const handleWeekChange = (week: number | null) => {
    // Use fresh params from window.location to avoid stale state
    const params = new URLSearchParams(window.location.search);
    if (week !== null) {
      params.set('week', week.toString());
    } else {
      params.delete('week');
    }
    const path = location.split('?')[0];
    const newSearch = params.toString();
    setLocation(`${path}${newSearch ? '?' + newSearch : ''}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between gap-2 py-3 md:py-4">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold truncate" data-testid="heading-app-title">
                <span className="hidden sm:inline">Fantasy Basketball Rankings</span>
                <span className="sm:hidden">FB Rankings</span>
              </h1>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {user && (
                <span className="hidden lg:inline text-sm text-muted-foreground mr-2" data-testid="text-username">
                  {user.username}
                </span>
              )}
              <SettingsDialog />
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await logout();
                  toast({
                    title: "Logged out",
                    description: "You have been logged out successfully",
                  });
                }}
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold" data-testid="heading-rankings-page">
            9-Cat Master Rankings
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            See where every team truly stands across all categories
          </p>
        </div>

        {isLoadingLeagues ? (
          <div className="text-center py-8 text-muted-foreground">Loading leagues...</div>
        ) : leagues.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No leagues found. Please connect your Yahoo account first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Select League</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedLeagueKey} onValueChange={setSelectedLeagueKey}>
                  <SelectTrigger data-testid="select-league">
                    <SelectValue placeholder="Choose a league to view rankings" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues.map((league) => (
                      <SelectItem
                        key={league.leagueKey}
                        value={league.leagueKey}
                        data-testid={`option-league-${league.leagueKey}`}
                      >
                        {league.leagueName} - {league.teamName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {isLoadingRankings && selectedLeagueKey && (
              <div className="text-center py-8 text-muted-foreground">
                Loading rankings...
              </div>
            )}

            {rankings.length > 0 && selectedLeague && metadata && (
              <LeagueRankings 
                rankings={rankings} 
                metadata={metadata}
                userTeamKey={selectedLeague.teamKey}
                selectedWeek={selectedWeek}
                onWeekChange={handleWeekChange}
              />
            )}

            {!selectedLeagueKey && (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">
                    Select a league above to view 9-category master rankings
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
