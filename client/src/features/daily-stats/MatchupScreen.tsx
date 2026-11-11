import type { WeeksResponse } from "@shared/api/daily-stats";
import { addDays, nbaDateOf } from "@shared/domain";
import { useWeeks } from "@/api/daily-stats-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAY_LABELS, type MatchupDay } from "@/features/league/screens";
import { selectionPath, type Selection } from "@/features/league/selection";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { LinkBar } from "./LinkBar";
import { MatchupDayBoard } from "./MatchupDayBoard";

/** The day bar reads in time order. */
const DAY_ORDER: readonly MatchupDay[] = ["yesterday", "today", "week"];

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

/** Matchup: the day bar, then the board for Today or Yesterday, or the week. */
export function MatchupScreen({ selection, onPickLeague }: MatchupScreenProps) {
  const now = useNow();
  const today = nbaDateOf(now);
  const { leagueKey, teamKey, day } = selection;
  const weeks = useWeeks(day === "week" ? leagueKey : null);
  const date = day === "today" ? today : addDays(today, -1);
  return (
    <div className="space-y-4">
      <LinkBar
        label="Day"
        testId="matchup-days"
        items={DAY_ORDER.map((item) => ({
          key: item,
          label: DAY_LABELS[item],
          href: selectionPath({ ...selection, day: item }),
          current: item === day,
        }))}
      />
      {day === "week" ? (
        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
          </CardHeader>
          <CardContent>
            <DatasetState query={weeks} onPickLeague={onPickLeague}>
              {(data) => <WeekRange weeks={data.weeks} today={today} />}
            </DatasetState>
          </CardContent>
        </Card>
      ) : (
        <MatchupDayBoard
          leagueKey={leagueKey}
          teamKey={teamKey}
          date={date}
          isToday={day === "today"}
          dateLabel={day === "today" ? "Today" : formatDate(date)}
          now={now}
          onPickLeague={onPickLeague}
        />
      )}
    </div>
  );
}
