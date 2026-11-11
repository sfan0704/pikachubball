import type { TeamDayResponse, WeeksResponse } from "@shared/api/daily-stats";
import { addDays, nbaDateOf } from "@shared/domain";
import { useTeamDay, useWeeks } from "@/api/daily-stats-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAY_LABELS, MATCHUP_DAYS } from "@/features/league/screens";
import { selectionPath, type Selection } from "@/features/league/selection";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { FreshnessLabel } from "./FreshnessLabel";
import { LinkBar } from "./LinkBar";

interface MatchupScreenProps {
  selection: Selection;
  onPickLeague: () => void;
}

/** A US Eastern date as the viewer reads it, for example "Wed, Nov 11". */
function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function TeamDayList({ day }: { day: TeamDayResponse }) {
  return (
    <ul className="space-y-2" data-testid="matchup-roster">
      {day.players.map(({ player, slot, isStartingSlot }) => (
        <li
          key={player.playerKey}
          className="flex items-center justify-between gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{player.name}</p>
            <p className="text-xs text-muted-foreground">
              {player.positions.join(", ")} · {player.nbaTeam}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {slot}
            {isStartingSlot ? "" : " (not counted)"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WeekRange({ weeks, today }: { weeks: WeeksResponse["weeks"]; today: string }) {
  const week = weeks.find(({ start, end }) => start <= today && today <= end);
  return (
    <p data-testid="matchup-week">
      {week
        ? `Week ${week.week}: ${formatDate(week.start)} to ${formatDate(week.end)}`
        : "Today isn't in a scoring week."}
    </p>
  );
}

/** Matchup: the day bar, then the user's team on the chosen day, labelled with its oldest section's age. */
export function MatchupScreen({ selection, onPickLeague }: MatchupScreenProps) {
  const now = useNow();
  const today = nbaDateOf(now);
  const { leagueKey, teamKey, day } = selection;
  const date = day === "week" ? null : day === "today" ? today : addDays(today, -1);
  const teamDay = useTeamDay(leagueKey, teamKey, date);
  const weeks = useWeeks(day === "week" ? leagueKey : null);
  return (
    <div className="space-y-4">
      <LinkBar
        label="Day"
        testId="matchup-days"
        items={MATCHUP_DAYS.map((item) => ({
          key: item,
          label: DAY_LABELS[item],
          href: selectionPath({ ...selection, day: item }),
          current: item === day,
        }))}
      />
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>{date === null ? "This week" : formatDate(date)}</CardTitle>
          <FreshnessLabel sources={[teamDay, weeks]} now={now} />
        </CardHeader>
        <CardContent>
          {date === null ? (
            <DatasetState query={weeks} onPickLeague={onPickLeague}>
              {(data) => <WeekRange weeks={data.weeks} today={today} />}
            </DatasetState>
          ) : (
            <DatasetState query={teamDay} onPickLeague={onPickLeague}>
              {(data) => <TeamDayList day={data} />}
            </DatasetState>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
