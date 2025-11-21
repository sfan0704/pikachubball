import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  const formatValue = (value: number, category: string, cat?: any) => {
    if (category === 'fgPct' && cat?.myTeamMakes !== undefined) {
      return `${cat.myTeamMakes}/${cat.myTeamAttempts} (${(value * 100).toFixed(1)}%)`;
    }
    if (category === 'ftPct' && cat?.myTeamMakes !== undefined) {
      return `${cat.myTeamMakes}/${cat.myTeamAttempts} (${(value * 100).toFixed(1)}%)`;
    }
    const isPct = category === 'fgPct' || category === 'ftPct';
    return isPct ? `${(value * 100).toFixed(1)}%` : Math.round(value).toString();
  };

  const calculateDiff = (myVal: number, oppVal: number, category: string) => {
    const isPct = category === 'fgPct' || category === 'ftPct';
    const diff = myVal - oppVal;
    if (isPct) {
      return `${(diff * 100).toFixed(1)}%`;
    }
    return (diff >= 0 ? '+' : '') + Math.round(diff).toString();
  };

  return (
    <Card data-testid="card-matchup">
      <CardHeader>
        <CardTitle>Weekly Matchup: {myTeam.teamName} vs {opponent.teamName}</CardTitle>
        <CardDescription>
          Week {metadata.week || metadata.currentWeek}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center gap-12 text-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{score.wins}</div>
            <div className="text-muted-foreground text-xs">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{score.ties}</div>
            <div className="text-muted-foreground text-xs">Ties</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{score.losses}</div>
            <div className="text-muted-foreground text-xs">Losses</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-semibold">Category</th>
                <th className="text-center py-3 px-2 font-semibold">{myTeam.teamName}</th>
                <th className="text-center py-3 px-2 font-semibold">{opponent.teamName}</th>
                <th className="text-center py-3 px-2 font-semibold">Diff</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr 
                  key={cat.category} 
                  className={`border-b ${cat.winning ? 'bg-green-500/5 dark:bg-green-500/5' : 'bg-red-500/5 dark:bg-red-500/5'}`}
                  data-testid={`matchup-category-${cat.category}`}
                >
                  <td className="py-3 px-2 font-medium">{CATEGORY_LABELS[cat.category]}</td>
                  <td className="text-center py-3 px-2">{formatValue(cat.myTeam, cat.category)}</td>
                  <td className="text-center py-3 px-2">{formatValue(cat.opponent, cat.category)}</td>
                  <td className="text-center py-3 px-2 font-semibold">
                    <span className={cat.winning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {calculateDiff(cat.myTeam, cat.opponent, cat.category)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
