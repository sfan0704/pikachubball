import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, Users, ArrowRightLeft } from "lucide-react";

interface QuickActionsProps {
  onActionClick: (action: string) => void;
}

export default function QuickActions({ onActionClick }: QuickActionsProps) {
  const actions = [
    { id: "start-sit", label: "Start/Sit Today", icon: Calendar },
    { id: "waiver", label: "Waiver Wire", icon: TrendingUp },
    { id: "trades", label: "Trade Suggestions", icon: ArrowRightLeft },
    { id: "matchup", label: "Matchup Analysis", icon: Users },
  ];

  return (
    <div className="py-3 px-4 border-b border-border bg-background">
      <div className="max-w-4xl mx-auto flex gap-2 overflow-x-auto">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              onClick={() => onActionClick(action.id)}
              className="flex-shrink-0 gap-2"
              data-testid={`button-quick-${action.id}`}
            >
              <Icon className="w-4 h-4" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}