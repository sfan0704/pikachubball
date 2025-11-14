import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ScheduleMatrixResponse } from "@shared/schema";

interface ScheduleTabProps {
  leagueKey: string;
  teamKey: string;
  week: number | null;
}

export default function ScheduleTab({ leagueKey, teamKey, week }: ScheduleTabProps) {
  const scheduleUrl = week 
    ? `/api/viz/schedule/${leagueKey}/${teamKey}?week=${week}`
    : `/api/viz/schedule/${leagueKey}/${teamKey}`;

  const { data: scheduleData, isLoading, error } = useQuery<ScheduleMatrixResponse>({
    queryKey: [scheduleUrl],
    enabled: !!leagueKey && !!teamKey,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading schedule...
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-destructive">
            Failed to load schedule data
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!scheduleData) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No schedule data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const { myTeam, opponent, metadata, isPlaceholder, placeholderMessage } = scheduleData;

  if (isPlaceholder && placeholderMessage) {
    return (
      <Card data-testid="card-schedule">
        <CardHeader>
          <CardTitle>Games Remaining Schedule</CardTitle>
          <CardDescription>
            Weekly schedule of player games
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Feature Unavailable</AlertTitle>
            <AlertDescription>
              {placeholderMessage}
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              This feature would show you:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Number of games each of your players has remaining this week</li>
              <li>Day-by-day breakdown of games</li>
              <li>Comparison with your opponent's game count</li>
              <li>Streaming opportunities (days with few games)</li>
            </ul>
            <p className="mt-4">
              To implement this feature, the application would need integration with an external NBA schedule API 
              (such as sportsdata.io or balldontlie.io) to retrieve real-time game schedules.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-schedule">
      <CardHeader>
        <CardTitle>Games Remaining Schedule</CardTitle>
        <CardDescription>
          {myTeam.teamName} - Week {metadata.week || metadata.currentWeek}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{myTeam.totalGames}</div>
              <div className="text-sm text-muted-foreground">{myTeam.teamName}</div>
            </div>
            {opponent && (
              <div>
                <div className="text-2xl font-bold">{opponent.totalGames}</div>
                <div className="text-sm text-muted-foreground">{opponent.teamName}</div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-center p-2">Your Games</th>
                  {opponent && <th className="text-center p-2">Opp Games</th>}
                </tr>
              </thead>
              <tbody>
                {myTeam.schedule.map((day, idx) => (
                  <tr key={day.date} className="border-b">
                    <td className="p-2">{day.dayOfWeek}</td>
                    <td className="text-center p-2">{day.gameCount}</td>
                    {opponent && (
                      <td className="text-center p-2">
                        {opponent.schedule[idx]?.gameCount || 0}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
