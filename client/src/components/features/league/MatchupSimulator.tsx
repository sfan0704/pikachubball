import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  managerName?: string;
  wins: number;
  losses: number;
  ties: number;
}

type SortColumn = "teamName" | "wins" | "ties" | "losses";
type SortDirection = "asc" | "desc";

export default function MatchupSimulator({ leagueKey, userTeamKey, week, rankings }: MatchupSimulatorProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>(userTeamKey);
  const [sortColumn, setSortColumn] = useState<SortColumn>("wins");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Get all other teams (opponents)
  const opponentTeams = rankings.filter(r => r.teamKey !== selectedTeam);
  
  // Fetch matchups for selected team against all others
  const matchupQueries = useQueries({
    queries: opponentTeams.map(opponent => {
      const params = new URLSearchParams();
      params.append("opponentTeamKey", opponent.teamKey);
      if (week) params.append("week", week.toString());
      return {
        queryKey: [`/api/viz/matchup/${leagueKey}/${selectedTeam}`, opponent.teamKey, week],
        queryFn: async () => {
          const response = await fetch(`/api/viz/matchup/${leagueKey}/${selectedTeam}?${params.toString()}`);
          if (!response.ok) throw new Error('Failed to fetch matchup');
          return response.json() as Promise<MatchupComparisonResponse>;
        },
        retry: false,
      };
    }),
  });

  // Build rows for matchup table
  const matchupRows: MatchupRow[] = matchupQueries
    .map((query, index) => {
      const opponentTeam = opponentTeams[index];
      if (!query.data) return null;
      return {
        teamKey: opponentTeam.teamKey,
        teamName: opponentTeam.teamName,
        managerName: opponentTeam.managerName || undefined,
        wins: query.data.score.wins,
        losses: query.data.score.losses,
        ties: query.data.score.ties,
      } as MatchupRow;
    })
    .filter((row) => row !== null) as MatchupRow[];

  const isLoading = matchupQueries.some(q => q.isLoading);
  const hasError = matchupQueries.some(q => q.error);

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

  const selectedTeamName = rankings.find(r => r.teamKey === selectedTeam)?.teamName || "Unknown";

  const getRowColor = (row: MatchupRow) => {
    if (row.wins > row.losses) {
      return "bg-green-500/5 dark:bg-green-500/5";
    } else if (row.wins < row.losses) {
      return "bg-red-500/5 dark:bg-red-500/5";
    } else {
      return "";
    }
  };

  return (
    <Card data-testid="card-simulator">
      <CardHeader>
        <CardTitle>Matchup Simulator</CardTitle>
        <CardDescription>
          See how any team would fare against all teams in the league
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Select Team</label>
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger data-testid="select-simulator-team">
              <SelectValue placeholder="Choose a team" />
            </SelectTrigger>
            <SelectContent>
              {rankings.map(team => (
                <SelectItem 
                  key={team.teamKey} 
                  value={team.teamKey}
                  data-testid={`option-simulator-team-${team.teamKey}`}
                >
                  {team.teamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasError && (
          <p className="text-center text-destructive py-8">
            Failed to load matchup data
          </p>
        )}

        {isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">Team</th>
                  <th className="text-center py-2 px-2 font-semibold text-green-600 dark:text-green-400">Wins</th>
                  <th className="text-center py-2 px-2 font-semibold text-yellow-600 dark:text-yellow-400">Ties</th>
                  <th className="text-center py-2 px-2 font-semibold text-red-600 dark:text-red-400">Losses</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 px-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
                    </td>
                    <td className="text-center py-2 px-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-8 mx-auto"></div>
                    </td>
                    <td className="text-center py-2 px-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-8 mx-auto"></div>
                    </td>
                    <td className="text-center py-2 px-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-8 mx-auto"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && matchupRows.length > 0 && (
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
                  <tr key={row.teamKey} className={`border-b hover:bg-accent/50 ${getRowColor(row)}`}>
                    <td className="py-2 px-2">
                      <div className="font-medium">{row.teamName}</div>
                      {row.managerName && <div className="text-xs text-muted-foreground">{row.managerName}</div>}
                    </td>
                    <td className="text-center py-2 px-2 text-green-600 dark:text-green-400 font-semibold">{row.wins}</td>
                    <td className="text-center py-2 px-2 text-yellow-600 dark:text-yellow-400 font-semibold">{row.ties}</td>
                    <td className="text-center py-2 px-2 text-red-600 dark:text-red-400 font-semibold">{row.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
