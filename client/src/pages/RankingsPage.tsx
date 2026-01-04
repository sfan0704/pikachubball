import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LeagueRankings from "@/components/features/league/LeagueRankings";
import MatchupTab from "@/components/features/league/MatchupTab";
import MatchupSimulator from "@/components/features/league/MatchupSimulator";
import ScheduleTab from "@/components/features/league/ScheduleTab";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useLocation, useSearch } from "wouter";
import { LogOut, MessageSquare, BarChart3, Calendar, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useChat } from "@/lib/chatContext";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/common/ThemeToggle";
import { RankingsSkeleton, LeagueSelectorSkeleton } from "@/components/common/RankingsSkeleton";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { useFirstLeague } from "@/hooks/useFirstLeague";
import type { RankingsResponse } from "@shared/schema";

export default function RankingsPage() {
  const [maxWeeks, setMaxWeeks] = useState<number>(0);
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const { user, logout } = useAuth();
  const { openChat, setSelectedTeamKey } = useChat();
  const { toast } = useToast();
  
  // Use the shared hook for league selection
  const { leagues, selectedLeagueKey, setSelectedLeagueKey, selectedLeague, isLoadingLeagues, error: leaguesError } = useFirstLeague();

  // Sync selected team to chat context when it changes
  useEffect(() => {
    if (selectedLeague?.teamKey) {
      setSelectedTeamKey(selectedLeague.teamKey);
    }
  }, [selectedLeague?.teamKey, setSelectedTeamKey]);

  // Check Yahoo connection status
  const { data: yahooStatus, isLoading: isLoadingYahooStatus } = useQuery<{
    connected: boolean;
    hasValidToken: boolean;
  }>({
    queryKey: ["/api/auth/yahoo/status"],
  });

  // Check for OAuth errors in URL and display them
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const details = params.get('details');
    const description = params.get('description');
    
    if (error) {
      let errorMessage = "Yahoo OAuth error occurred";
      
      if (error === 'yahoo_oauth_error') {
        errorMessage = details || description || "Yahoo OAuth authorization failed";
      } else if (error === 'token_exchange_failed') {
        errorMessage = details || "Failed to exchange authorization code.";
      } else if (error === 'missing_code') {
        errorMessage = "Missing authorization code. Please try connecting again.";
      } else if (error === 'invalid_state') {
        errorMessage = "Invalid OAuth state. Please try connecting again.";
      } else if (error === 'not_authenticated') {
        errorMessage = "You must be logged in to connect Yahoo.";
      }
      
      toast({
        title: "Yahoo Connection Error",
        description: errorMessage,
        variant: "destructive",
        duration: 10000,
      });
      
      // Clean up URL
      params.delete('error');
      params.delete('details');
      params.delete('description');
      const newSearch = params.toString();
      const path = location.split('?')[0];
      setLocation(`${path}${newSearch ? '?' + newSearch : ''}`, { replace: true });
    } else if (params.get('yahoo_connected') === 'true') {
      toast({
        title: "Successfully Connected",
        description: "Your Yahoo Fantasy account has been connected!",
      });
      // Invalidate status query to refresh connection state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
      params.delete('yahoo_connected');
      const newSearch = params.toString();
      const path = location.split('?')[0];
      setLocation(`${path}${newSearch ? '?' + newSearch : ''}`, { replace: true });
    }
  }, [location, setLocation, toast]);

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


  // Build query URL with week parameter
  const rankingsUrl = useMemo(() => {
    if (!selectedLeagueKey) return null;
    return selectedWeek 
      ? `/api/yahoo/league-rankings/${selectedLeagueKey}?week=${selectedWeek}`
      : `/api/yahoo/league-rankings/${selectedLeagueKey}`;
  }, [selectedLeagueKey, selectedWeek]);

  const { data: rankingsData, isLoading: isLoadingRankings, error: rankingsError } = useQuery<RankingsResponse>({
    queryKey: [rankingsUrl],
    enabled: !!rankingsUrl,
    retry: false,
  });

  const rankings = rankingsData?.rankings || [];
  const metadata = rankingsData?.metadata;
  
  // Preserve max weeks count so dropdown options don't disappear during loading
  useEffect(() => {
    if (metadata?.currentWeek) {
      setMaxWeeks(metadata.currentWeek);
    }
  }, [metadata?.currentWeek]);

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

  const isLoading = isLoadingLeagues || isLoadingYahooStatus;

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
                      {selectedLeague?.teamName || user.email || user.displayName || user.username}
                    </span>
                  )}
              <Button
                variant="ghost"
                size="icon"
                onClick={openChat}
                data-testid="button-header-chat"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
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

      <div className="container mx-auto p-4 md:p-6 pb-24 md:pb-28 space-y-4 md:space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold" data-testid="heading-rankings-page">
            9-Cat Master Rankings
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            See where every team truly stands across all categories
          </p>
        </div>

        {/* Error Banners */}
        {leaguesError && yahooStatus?.connected && (
          <ErrorBanner
            title="Failed to Load Leagues"
            message={leaguesError.message || "Unable to load your leagues. Please try again."}
            onRetry={() => queryClient.invalidateQueries({ queryKey: ["/api/yahoo/leagues"] })}
          />
        )}
        {rankingsError && selectedLeagueKey && yahooStatus?.connected && (
          <ErrorBanner
            title="Failed to Load Rankings"
            message={rankingsError instanceof Error ? rankingsError.message : "Unable to load rankings data. Please try again."}
            onRetry={() => queryClient.invalidateQueries({ queryKey: [rankingsUrl] })}
          />
        )}

        {isLoading ? (
          <LeagueSelectorSkeleton />
        ) : !yahooStatus?.connected ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <p className="text-lg font-medium text-muted-foreground">
                  Yahoo Connection Required
                </p>
                <p className="text-sm text-muted-foreground">
                  Please log out and sign in with Yahoo to access your fantasy leagues.
                </p>
                <Button
                  onClick={async () => {
                    await logout();
                  }}
                  size="lg"
                >
                  Sign Out & Reconnect
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : leagues.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <p className="text-lg font-medium text-muted-foreground">
                  No leagues found
                </p>
                <p className="text-sm text-muted-foreground">
                  You don't have any Yahoo Fantasy Basketball leagues yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Select League & Time Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  <div className="flex-1">
                    <label htmlFor="league-select" className="text-xs md:text-sm font-medium mb-2 block">
                      League
                    </label>
                    <Select value={selectedLeagueKey} onValueChange={setSelectedLeagueKey}>
                      <SelectTrigger id="league-select" data-testid="select-league">
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
                  </div>
                  
                  {selectedLeagueKey && (
                    <div className="flex-1">
                      <label htmlFor="week-select" className="text-xs md:text-sm font-medium mb-2 block">
                        Time Period
                      </label>
                      <Select 
                        value={selectedWeek?.toString() || "season"} 
                        onValueChange={(value) => handleWeekChange(value === "season" ? null : parseInt(value))}
                        disabled={isLoadingRankings}
                      >
                        <SelectTrigger id="week-select" data-testid="select-week">
                          <SelectValue placeholder="Select week" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="season" data-testid="option-season">Season (to date)</SelectItem>
                          {maxWeeks > 0 && Array.from({ length: maxWeeks }, (_, i) => i + 1).reverse().map((week) => (
                            <SelectItem key={week} value={week.toString()} data-testid={`option-week-${week}`}>
                              Week {week}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedLeagueKey && yahooStatus?.connected ? (
              <Tabs defaultValue="rankings" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4" data-testid="tabs-visualizations">
                  <TabsTrigger value="rankings" data-testid="tab-rankings" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Rankings</span>
                  </TabsTrigger>
                  <TabsTrigger value="matchup" data-testid="tab-matchup" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Matchup</span>
                  </TabsTrigger>
                  <TabsTrigger value="simulator" data-testid="tab-simulator" className="gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Simulator</span>
                  </TabsTrigger>
                  <TabsTrigger value="schedule" data-testid="tab-schedule" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Schedule</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="rankings" className="space-y-4">
                  {isLoadingRankings ? (
                    <RankingsSkeleton />
                  ) : rankings.length > 0 && selectedLeague ? (
                    <LeagueRankings 
                      rankings={rankings} 
                      userTeamKey={selectedLeague.teamKey}
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <p className="text-center text-muted-foreground">
                          No rankings data available
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="matchup">
                  {selectedLeague ? (
                    <MatchupTab 
                      leagueKey={selectedLeagueKey} 
                      teamKey={selectedLeague.teamKey}
                      week={selectedWeek} 
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <p className="text-center text-muted-foreground">
                          Select a league to view matchup comparison
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="simulator">
                  {selectedLeague && rankings.length > 0 ? (
                    <MatchupSimulator 
                      leagueKey={selectedLeagueKey}
                      userTeamKey={selectedLeague.teamKey}
                      week={selectedWeek}
                      rankings={rankings}
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <p className="text-center text-muted-foreground">
                          Select a league to use matchup simulator
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="schedule">
                  {selectedLeague ? (
                    <ScheduleTab 
                      leagueKey={selectedLeagueKey} 
                      teamKey={selectedLeague.teamKey}
                      week={selectedWeek} 
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <p className="text-center text-muted-foreground">
                          Select a league to view schedule
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">
                    Select a league above to view visualizations
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
