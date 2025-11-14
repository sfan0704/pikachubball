import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { LeagueHeatmapResponse } from "@shared/schema";

interface HeatmapTabProps {
  leagueKey: string;
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

const CATEGORIES = Object.keys(CATEGORY_LABELS);

function getPercentileColor(percentile: number): string {
  if (percentile >= 75) return "bg-green-500/20 border-green-500/40";
  if (percentile >= 50) return "bg-yellow-500/20 border-yellow-500/40";
  if (percentile >= 25) return "bg-orange-500/20 border-orange-500/40";
  return "bg-red-500/20 border-red-500/40";
}

export default function HeatmapTab({ leagueKey, week }: HeatmapTabProps) {
  const heatmapUrl = week 
    ? `/api/viz/heatmap/${leagueKey}?week=${week}`
    : `/api/viz/heatmap/${leagueKey}`;

  const { data: heatmapData, isLoading, error } = useQuery<LeagueHeatmapResponse>({
    queryKey: [heatmapUrl],
    enabled: !!leagueKey,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading heatmap...
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-destructive">
            Failed to load heatmap data
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!heatmapData || heatmapData.teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No heatmap data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const { teams, metadata } = heatmapData;

  return (
    <Card data-testid="card-heatmap">
      <CardHeader>
        <CardTitle>League Category Heatmap</CardTitle>
        <CardDescription>
          {metadata.scope === 'week' 
            ? `Week ${metadata.week} performance across all categories`
            : 'Season-long performance across all categories'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="grid gap-1" style={{ gridTemplateColumns: `minmax(150px, 1fr) repeat(${CATEGORIES.length}, minmax(80px, 1fr))` }}>
              <div className="font-semibold p-2 text-sm">Team</div>
              {CATEGORIES.map(cat => (
                <div key={cat} className="font-semibold p-2 text-sm text-center">
                  {CATEGORY_LABELS[cat]}
                </div>
              ))}
              
              {teams.map(team => (
                <div key={team.teamKey} className="contents" data-testid={`heatmap-row-${team.teamKey}`}>
                  <div className="p-2 text-sm font-medium border-t">
                    {team.teamName}
                  </div>
                  {CATEGORIES.map(cat => {
                    const cell = team.categories[cat as keyof typeof team.categories];
                    const colorClass = getPercentileColor(cell.percentile);
                    let formattedValue: string;
                    if (cat === 'fgPct' || cat === 'ftPct') {
                      formattedValue = (cell.value * 100).toFixed(1) + '%';
                    } else {
                      formattedValue = Math.round(cell.value).toString();
                    }
                    return (
                      <div
                        key={`${team.teamKey}-${cat}`}
                        className={`p-2 text-sm text-center border border-border ${colorClass}`}
                        data-testid={`heatmap-cell-${team.teamKey}-${cat}`}
                      >
                        <div className="font-mono text-xs font-semibold">
                          {formattedValue}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          #{cell.rank}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/40"></div>
            <span>Top 25%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/40"></div>
            <span>50-75%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500/40"></div>
            <span>25-50%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/40"></div>
            <span>Bottom 25%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
