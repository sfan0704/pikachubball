import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlayerStatCardProps {
  name: string;
  position: string;
  team: string;
  stats: {
    label: string;
    value: string | number;
  }[];
  trend?: "up" | "down" | "neutral";
}

export default function PlayerStatCard({ name, position, team, stats, trend }: PlayerStatCardProps) {
  return (
    <Card className="p-4 hover-elevate" data-testid={`card-player-${name.replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-base" data-testid="text-player-name">{name}</h3>
          <p className="text-sm text-muted-foreground" data-testid="text-player-team">{team}</p>
        </div>
        <Badge variant="secondary" className="text-xs" data-testid="badge-position">
          {position}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, idx) => (
          <div key={idx} data-testid={`stat-${idx}`}>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-mono font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>
      
      {trend && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Trend: <span className={`font-semibold ${
              trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : ""
            }`}>{trend === "up" ? "↑ Improving" : trend === "down" ? "↓ Declining" : "→ Stable"}</span>
          </p>
        </div>
      )}
    </Card>
  );
}