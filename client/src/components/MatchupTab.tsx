import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import type { MatchupComparisonResponse } from "@shared/schema";

interface MatchupTabProps {
  leagueKey: string;
  teamKey: string;
  week: number | null;
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

export default function MatchupTab({ leagueKey, teamKey, week }: MatchupTabProps) {
  const matchupUrl = week 
    ? `/api/viz/matchup/${leagueKey}/${teamKey}?week=${week}`
    : `/api/viz/matchup/${leagueKey}/${teamKey}`;

  const { data: matchupData, isLoading, error } = useQuery<MatchupComparisonResponse>({
    queryKey: [matchupUrl],
    enabled: !!leagueKey && !!teamKey,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading matchup comparison...
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-destructive">
            Failed to load matchup data
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!matchupData) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No matchup data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const { myTeam, opponent, categories, score, metadata } = matchupData;

  const chartData = categories.map(cat => {
    const isPct = cat.category === 'fgPct' || cat.category === 'ftPct';
    return {
      category: CATEGORY_LABELS[cat.category] || cat.category,
      myTeam: isPct ? parseFloat((cat.myTeam * 100).toFixed(1)) : Math.round(cat.myTeam),
      opponent: isPct ? parseFloat((cat.opponent * 100).toFixed(1)) : Math.round(cat.opponent),
      winning: cat.winning,
      isPct
    };
  });

  return (
    <Card data-testid="card-matchup">
      <CardHeader>
        <CardTitle>Weekly Matchup Comparison</CardTitle>
        <CardDescription>
          {myTeam.teamName} vs {opponent.teamName} - Week {metadata.week || metadata.currentWeek}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center gap-8 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{score.wins}</div>
            <div className="text-muted-foreground">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{score.ties}</div>
            <div className="text-muted-foreground">Ties</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{score.losses}</div>
            <div className="text-muted-foreground">Losses</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mb-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></div>
            <span>{myTeam.teamName}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></div>
            <span>{opponent.teamName}</span>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="horizontal" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="category" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length >= 2) {
                  const data = payload[0].payload;
                  const myValue = typeof payload[0].value === 'number' ? payload[0].value : 0;
                  const oppValue = typeof payload[1].value === 'number' ? payload[1].value : 0;
                  return (
                    <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
                      <p className="font-semibold mb-2">{data.category}</p>
                      <div className="space-y-1">
                        <p className="text-sm" style={{ color: 'hsl(var(--chart-1))' }}>
                          {myTeam.teamName}: {data.isPct ? `${myValue.toFixed(1)}%` : myValue}
                        </p>
                        <p className="text-sm" style={{ color: 'hsl(var(--chart-2))' }}>
                          {opponent.teamName}: {data.isPct ? `${oppValue.toFixed(1)}%` : oppValue}
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
            <Bar dataKey="myTeam" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="opponent" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4">
          <h4 className="font-semibold mb-2 text-sm">Category Breakdown:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {categories.map(cat => (
              <div 
                key={cat.category} 
                className={`p-2 rounded border ${cat.winning ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}
                data-testid={`matchup-category-${cat.category}`}
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
  );
}
