import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import type { MatchupComparisonResponse, RankingsResponse } from "@shared/schema";

interface MatchupSimulatorProps {
  leagueKey: string;
  userTeamKey: string;
  week: number | null;
  rankings: RankingsResponse['rankings'];
}

const CATEGORY_LABELS: Record<string, string> = {
  fgPct: "FG%",
  ftPct: "FT%",
  tpm: "3PM",
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  to: "TO"
};

type SimulatorMode = "myTeam" | "anyTeams";

export default function MatchupSimulator({ leagueKey, userTeamKey, week, rankings }: MatchupSimulatorProps) {
  const [mode, setMode] = useState<SimulatorMode>("myTeam");
  const [selectedOpponent, setSelectedOpponent] = useState<string>("");
  const [selectedTeam1, setSelectedTeam1] = useState<string>("");
  const [selectedTeam2, setSelectedTeam2] = useState<string>("");

  // Build the appropriate query URL
  const team1Key = mode === "myTeam" ? userTeamKey : selectedTeam1;
  const team2Key = mode === "myTeam" ? selectedOpponent : selectedTeam2;

  const matchupUrl = 
    mode === "myTeam" && selectedOpponent
      ? week 
        ? `/api/viz/matchup/${leagueKey}/${team1Key}/${team2Key}?week=${week}`
        : `/api/viz/matchup/${leagueKey}/${team1Key}/${team2Key}`
      : mode === "anyTeams" && selectedTeam1 && selectedTeam2
      ? week
        ? `/api/viz/matchup/${leagueKey}/${team1Key}/${team2Key}?week=${week}`
        : `/api/viz/matchup/${leagueKey}/${team1Key}/${team2Key}`
      : null;

  const { data: matchupData, isLoading, error } = useQuery<MatchupComparisonResponse>({
    queryKey: [matchupUrl],
    enabled: !!matchupUrl,
    retry: false,
  });

  const chartData = matchupData?.categories.map(cat => {
    const isPct = cat.category === 'fgPct' || cat.category === 'ftPct';
    return {
      category: CATEGORY_LABELS[cat.category] || cat.category,
      team1: isPct ? parseFloat((cat.myTeam * 100).toFixed(1)) : Math.round(cat.myTeam),
      team2: isPct ? parseFloat((cat.opponent * 100).toFixed(1)) : Math.round(cat.opponent),
      winning: cat.winning,
      isPct
    };
  }) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Matchup Simulator</CardTitle>
          <CardDescription>
            {mode === "myTeam" 
              ? "See how your team would fare against any team in the league"
              : "Compare any two teams in the league head-to-head"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "myTeam" ? "default" : "outline"}
              onClick={() => {
                setMode("myTeam");
                setSelectedOpponent("");
                setSelectedTeam1("");
                setSelectedTeam2("");
              }}
              data-testid="button-mode-myteam"
            >
              Simulate My Team
            </Button>
            <Button
              variant={mode === "anyTeams" ? "default" : "outline"}
              onClick={() => {
                setMode("anyTeams");
                setSelectedOpponent("");
                setSelectedTeam1("");
                setSelectedTeam2("");
              }}
              data-testid="button-mode-anyteams"
            >
              Compare Any Teams
            </Button>
          </div>

          {/* Mode-specific selectors */}
          <div className="space-y-3">
            {mode === "myTeam" ? (
              <div>
                <label className="text-sm font-medium">Select Opponent</label>
                <Select value={selectedOpponent} onValueChange={setSelectedOpponent}>
                  <SelectTrigger data-testid="select-opponent">
                    <SelectValue placeholder="Choose a team to compare against" />
                  </SelectTrigger>
                  <SelectContent>
                    {rankings
                      .filter(r => r.teamKey !== userTeamKey)
                      .map(team => (
                        <SelectItem 
                          key={team.teamKey} 
                          value={team.teamKey}
                          data-testid={`option-opponent-${team.teamKey}`}
                        >
                          {team.teamName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Select First Team</label>
                  <Select value={selectedTeam1} onValueChange={setSelectedTeam1}>
                    <SelectTrigger data-testid="select-team1">
                      <SelectValue placeholder="Choose first team" />
                    </SelectTrigger>
                    <SelectContent>
                      {rankings.map(team => (
                        <SelectItem 
                          key={team.teamKey} 
                          value={team.teamKey}
                          data-testid={`option-team1-${team.teamKey}`}
                        >
                          {team.teamName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Select Second Team</label>
                  <Select value={selectedTeam2} onValueChange={setSelectedTeam2}>
                    <SelectTrigger data-testid="select-team2">
                      <SelectValue placeholder="Choose second team" />
                    </SelectTrigger>
                    <SelectContent>
                      {rankings
                        .filter(r => r.teamKey !== selectedTeam1)
                        .map(team => (
                          <SelectItem 
                            key={team.teamKey} 
                            value={team.teamKey}
                            data-testid={`option-team2-${team.teamKey}`}
                          >
                            {team.teamName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          Loading comparison...
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-destructive">
              Failed to load matchup data
            </p>
          </CardContent>
        </Card>
      )}

      {matchupData && (
        <Card data-testid="card-simulator-results">
          <CardHeader>
            <CardTitle>Comparison Results</CardTitle>
            <CardDescription>
              {matchupData.myTeam.teamName} vs {matchupData.opponent.teamName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* W/L/T Score */}
            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {matchupData.score.wins}
                </div>
                <div className="text-muted-foreground">Wins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {matchupData.score.ties}
                </div>
                <div className="text-muted-foreground">Ties</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {matchupData.score.losses}
                </div>
                <div className="text-muted-foreground">Losses</div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mb-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></div>
                <span>{matchupData.myTeam.teamName}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></div>
                <span>{matchupData.opponent.teamName}</span>
              </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="horizontal" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="category" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length >= 2) {
                      const data = payload[0].payload;
                      const team1Value = typeof payload[0].value === 'number' ? payload[0].value : 0;
                      const team2Value = typeof payload[1].value === 'number' ? payload[1].value : 0;
                      return (
                        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
                          <p className="font-semibold mb-2">{data.category}</p>
                          <div className="space-y-1">
                            <p className="text-sm" style={{ color: 'hsl(var(--chart-1))' }}>
                              {matchupData.myTeam.teamName}: {data.isPct ? `${team1Value.toFixed(1)}%` : team1Value}
                            </p>
                            <p className="text-sm" style={{ color: 'hsl(var(--chart-2))' }}>
                              {matchupData.opponent.teamName}: {data.isPct ? `${team2Value.toFixed(1)}%` : team2Value}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {data.winning ? '✓ Winning' : '✗ Losing'}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="team1" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="team2" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Category Breakdown */}
            <div>
              <h4 className="font-semibold mb-2 text-sm">Category Breakdown:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {matchupData.categories.map(cat => (
                  <div 
                    key={cat.category} 
                    className={`p-2 rounded border ${cat.winning ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}
                    data-testid={`simulator-category-${cat.category}`}
                  >
                    <div className="font-semibold">{CATEGORY_LABELS[cat.category]}</div>
                    <div className="text-xs text-muted-foreground">
                      {cat.myTeam.toFixed(1)} vs {cat.opponent.toFixed(1)}
                      {cat.winning ? ' ✓' : ' ✗'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
