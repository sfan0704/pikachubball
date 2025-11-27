import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LeagueRankings from "@/components/LeagueRankings";
import MatchupTab from "@/components/MatchupTab";
import MatchupSimulator from "@/components/MatchupSimulator";
import ScheduleTab from "@/components/ScheduleTab";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocation, useSearch } from "wouter";
import { LogOut, MessageSquare, BarChart3, Calendar, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useChat } from "@/lib/chat-context";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsDialog from "@/components/SettingsDialog";
import { useFirstLeague } from "@/hooks/useFirstLeague";
import type { RankingsResponse } from "@shared/schema";

export default function RankingsPage() {
  const [maxWeeks, setMaxWeeks] = useState<number>(0);
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const { user, logout } = useAuth();
  const { openChat } = useChat();
  const { toast } = useToast();
  
  // Use the shared hook for league selection
  const { leagues, selectedLeagueKey, setSelectedLeagueKey, selectedLeague, isLoadingLeagues } = useFirstLeague();

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

  const { data: rankingsData, isLoading: isLoadingRankings } = useQuery<RankingsResponse>({
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
              <Button
                variant="ghost"
                size="icon"
                onClick={openChat}
                data-testid="button-header-chat"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
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

      <div className="container mx-auto p-4 md:p-6 pb-24 md:pb-28 space-y-4 md:space-y-6">
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
                          {maxWeeks > 0 && Array.from({ length: maxWeeks }, (_, i) => i + 1).map((week) => (
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

            {selectedLeagueKey ? (
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
                    <div className="text-center py-8 text-muted-foreground">Loading rankings...</div>
                  ) : rankings.length > 0 && selectedLeague && metadata ? (
                    <LeagueRankings 
                      rankings={rankings} 
                      metadata={metadata}
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
