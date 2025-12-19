import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Player {
  name: string;
  position: string;
  team: string;
  status: "active" | "injured" | "out";
}

interface TeamRosterProps {
  players: Player[];
}

export default function TeamRoster({ players }: TeamRosterProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-600/10 text-green-600 border-green-600/20";
      case "injured":
        return "bg-yellow-600/10 text-yellow-600 border-yellow-600/20";
      case "out":
        return "bg-red-600/10 text-red-600 border-red-600/20";
      default:
        return "";
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-lg mb-4" data-testid="heading-roster">My Roster</h3>
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {players.map((player, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg hover-elevate border border-border"
              data-testid={`roster-player-${idx}`}
            >
              <div className="flex-1">
                <p className="font-medium text-sm" data-testid="text-player-name">{player.name}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-player-info">
                  {player.position} • {player.team}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-xs ${getStatusColor(player.status)}`}
                data-testid="badge-status"
              >
                {player.status}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}