import { useQuery, useQueries } from "@tanstack/react-query";
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

interface MatchupRow {
  teamKey: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
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

type SortColumn = "teamName" | "wins" | "ties" | "losses";
type SortDirection = "asc" | "desc";

export default function MatchupSimulator({ leagueKey, userTeamKey, week, rankings }: MatchupSimulatorProps) {
  const [mode, setMode] = useState<SimulatorMode>("myTeam");
  const [selectedTeam1, setSelectedTeam1] = useState<string>("");
  const [selectedTeam2, setSelectedTeam2] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("wins");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch all matchups for myTeam mode
  const opponentTeams = rankings.filter(r => r.teamKey !== userTeamKey);
  
  const matchupQueries = useQueries({
    queries: mode === "myTeam" ? opponentTeams.map(opponent => {
      const params = new URLSearchParams();
      params.append("opponentTeamKey", opponent.teamKey);
      if (week) params.append("week", week.toString());
      return {
        queryKey: [`/api/viz/matchup/${leagueKey}/${userTeamKey}`, opponent.teamKey],
        queryFn: async () => {
          const response = await fetch(`/api/viz/matchup/${leagueKey}/${userTeamKey}?${params.toString()}`);
          if (!response.ok) throw new Error('Failed to fetch matchup');
          return response.json() as Promise<MatchupComparisonResponse>;
        },
        retry: false,
      };
    }) : [],
  });

  // For Compare Any Teams mode
  let detailMatchupUrl: string | null = null;
  if (mode === "anyTeams" && selectedTeam1 && selectedTeam2) {
    const params = new URLSearchParams();
    params.append("opponentTeamKey", selectedTeam2);
    if (week) params.append("week", week.toString());
    detailMatchupUrl = `/api/viz/matchup/${leagueKey}/${selectedTeam1}?${params.toString()}`;
  }

  const { data: detailMatchupData, isLoading: detailIsLoading, error: detailError } = useQuery<MatchupComparisonResponse>({
    queryKey: [detailMatchupUrl],
    enabled: !!detailMatchupUrl,
    retry: false,
  });

  const chartData = detailMatchupData?.categories.map(cat => {
    const isPct = cat.category === 'fgPct' || cat.category === 'ftPct';
    return {
      category: CATEGORY_LABELS[cat.category] || cat.category,
      team1: isPct ? parseFloat((cat.myTeam * 100).toFixed(1)) : Math.round(cat.myTeam),
      team2: isPct ? parseFloat((cat.opponent * 100).toFixed(1)) : Math.round(cat.opponent),
      winning: cat.winning,
      isPct
    };
  }) || [];

  // Build rows for Simulate My Team table
  const matchupRows: MatchupRow[] = matchupQueries
    .map((query, index) => {
      const opponentTeam = opponentTeams[index];
      if (!query.data) return null;
      return {
        teamKey: opponentTeam.teamKey,
        teamName: opponentTeam.teamName,
        wins: query.data.score.wins,
        losses: query.data.score.losses,
        ties: query.data.score.ties,
      };
    })
    .filter((row): row is MatchupRow => row !== null);

  const isLoadingMatchups = matchupQueries.some(q => q.isLoading);
  const matchupError = matchupQueries.some(q => q.error);

  // Sort function
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Apply sorting to matchup rows
  const sortedRows = [...matchupRows].sort((a, b) => {
    let aValue: string | number = a[sortColumn];
    let bValue: string | number = b[sortColumn];

    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = (bValue as string).toLowerCase();
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <span className="text-muted-foreground ml-1">↕</span>;
    return sortDirection === "asc" ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Matchup Simulator</CardTitle>
          <CardDescription>
            {mode === "myTeam" 
              ? "See how your team would fare against all teams in the league"
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
                setSelectedTeam1("");
                setSelectedTeam2("");
              }}
              data-testid="button-mode-anyteams"
            >
              Compare Any Teams
            </Button>
          </div>

          {/* Compare Any Teams mode - selectors */}
          {mode === "anyTeams" && (
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
        </CardContent>
      </Card>

      {/* Simulate My Team - Table Results */}
      {mode === "myTeam" && (
        <>
          {isLoadingMatchups && (
            <div className="text-center py-12 text-muted-foreground">
              Loading all matchups...
            </div>
          )}

          {matchupError && (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-destructive">
                  Failed to load some matchup data
                </p>
              </CardContent>
            </Card>
          )}

          {matchupRows.length > 0 && (
            <Card data-testid="card-simulator-results">
              <CardHeader>
                <CardTitle>Your Matchups Against All Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th 
                          className="text-left py-2 px-2 font-semibold cursor-pointer hover:bg-accent/50"
                          onClick={() => handleSort("teamName")}
                          data-testid="header-teamname"
                        >
                          Team <SortIndicator column="teamName" />
                        </th>
                        <th 
                          className="text-center py-2 px-2 font-semibold text-green-600 dark:text-green-400 cursor-pointer hover:bg-accent/50"
                          onClick={() => handleSort("wins")}
                          data-testid="header-wins"
                        >
                          Wins <SortIndicator column="wins" />
                        </th>
                        <th 
                          className="text-center py-2 px-2 font-semibold text-yellow-600 dark:text-yellow-400 cursor-pointer hover:bg-accent/50"
                          onClick={() => handleSort("ties")}
                          data-testid="header-ties"
                        >
                          Ties <SortIndicator column="ties" />
                        </th>
                        <th 
                          className="text-center py-2 px-2 font-semibold text-red-600 dark:text-red-400 cursor-pointer hover:bg-accent/50"
                          onClick={() => handleSort("losses")}
                          data-testid="header-losses"
                        >
                          Losses <SortIndicator column="losses" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map(row => (
                        <tr key={row.teamKey} className="border-b hover:bg-accent/50">
                          <td className="py-2 px-2 font-medium">{row.teamName}</td>
                          <td className="text-center py-2 px-2 text-green-600 dark:text-green-400 font-semibold">{row.wins}</td>
                          <td className="text-center py-2 px-2 text-yellow-600 dark:text-yellow-400 font-semibold">{row.ties}</td>
                          <td className="text-center py-2 px-2 text-red-600 dark:text-red-400 font-semibold">{row.losses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Compare Any Teams - Chart Results */}
      {mode === "anyTeams" && (
        <>
          {detailIsLoading && (
            <div className="text-center py-12 text-muted-foreground">
              Loading comparison...
            </div>
          )}

          {detailError && (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-destructive">
                  Failed to load matchup data
                </p>
              </CardContent>
            </Card>
          )}

          {detailMatchupData && (
            <Card data-testid="card-simulator-results">
              <CardHeader>
                <CardTitle>Comparison Results</CardTitle>
                <CardDescription>
                  {detailMatchupData.myTeam.teamName} vs {detailMatchupData.opponent.teamName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* W/L/T Score */}
                <div className="flex justify-center gap-8 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {detailMatchupData.score.wins}
                    </div>
                    <div className="text-muted-foreground">Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {detailMatchupData.score.ties}
                    </div>
                    <div className="text-muted-foreground">Ties</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {detailMatchupData.score.losses}
                    </div>
                    <div className="text-muted-foreground">Losses</div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mb-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></div>
                    <span>{detailMatchupData.myTeam.teamName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></div>
                    <span>{detailMatchupData.opponent.teamName}</span>
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
                                  {detailMatchupData.myTeam.teamName}: {data.isPct ? `${team1Value.toFixed(1)}%` : team1Value}
                                </p>
                                <p className="text-sm" style={{ color: 'hsl(var(--chart-2))' }}>
                                  {detailMatchupData.opponent.teamName}: {data.isPct ? `${team2Value.toFixed(1)}%` : team2Value}
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
                    {detailMatchupData.categories.map(cat => (
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
        </>
      )}
    </div>
  );
}
