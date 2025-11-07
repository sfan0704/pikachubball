import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeagueRankings from "@/components/LeagueRankings";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import type { League, TeamRanking } from "@shared/schema";

export default function RankingsPage() {
  const [selectedLeagueKey, setSelectedLeagueKey] = useState<string>("");

  const { data: leaguesData, isLoading: isLoadingLeagues } = useQuery<{
    leagues: League[];
  }>({
    queryKey: ["/api/yahoo/leagues"],
    retry: false,
  });

  const leagues = leaguesData?.leagues || [];
  const selectedLeague = leagues.find(l => l.leagueKey === selectedLeagueKey);

  const { data: rankingsData, isLoading: isLoadingRankings } = useQuery<{
    rankings: TeamRanking[];
  }>({
    queryKey: ['/api/yahoo/league-rankings', selectedLeagueKey],
    enabled: !!selectedLeagueKey,
    retry: false,
  });

  const rankings = rankingsData?.rankings || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold truncate" data-testid="heading-rankings-page">
              9-Cat Master Rankings
            </h1>
            <p className="text-sm md:text-base text-muted-foreground truncate">
              See where every team truly stands across all categories
            </p>
          </div>
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

            {rankings.length > 0 && selectedLeague && (
              <LeagueRankings rankings={rankings} userTeamKey={selectedLeague.teamKey} />
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
