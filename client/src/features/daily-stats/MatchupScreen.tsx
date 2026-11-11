import { useState } from "react";
import type { TeamDayResponse, WeeksResponse } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { addDays, nbaDateOf } from "@shared/domain";
import { useTeamDay, useWeeks } from "@/api/daily-stats-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAY_LABELS, MATCHUP_DAYS } from "@/features/league/screens";
import { selectionPath, type Selection } from "@/features/league/selection";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { LinkBar } from "./LinkBar";
import { PlayerDetailSheet } from "./PlayerDetailSheet";
import { PlayerButton } from "./PlayerButton";

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

interface TeamDayListProps {
  day: TeamDayResponse;
  /** Injury tags are today's status, so they show only on today's list. */
  isToday: boolean;
  onOpenPlayer: (player: DailyPlayer) => void;
}

function TeamDayList({ day, isToday, onOpenPlayer }: TeamDayListProps) {
  return (
    <ul className="space-y-2" data-testid="matchup-roster">
      {day.players.map(({ player, slot, isStartingSlot }) => (
        <li
          key={player.playerKey}
          className="flex items-center justify-between gap-3 rounded-lg border p-3"
        >
          <PlayerButton player={player} showInjury={isToday} onOpen={onOpenPlayer} />
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

/** Matchup: the day bar, then the user's team on the chosen day. */
export function MatchupScreen({ selection, onPickLeague }: MatchupScreenProps) {
  const today = nbaDateOf(useNow());
  const { leagueKey, teamKey, day } = selection;
  const date = day === "week" ? null : day === "today" ? today : addDays(today, -1);
  const teamDay = useTeamDay(leagueKey, teamKey, date);
  const weeks = useWeeks(day === "week" ? leagueKey : null);
  const [openPlayer, setOpenPlayer] = useState<DailyPlayer | null>(null);
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
        <CardHeader>
          <CardTitle>{date === null ? "This week" : formatDate(date)}</CardTitle>
        </CardHeader>
        <CardContent>
          {date === null ? (
            <DatasetState query={weeks} onPickLeague={onPickLeague}>
              {(data) => <WeekRange weeks={data.weeks} today={today} />}
            </DatasetState>
          ) : (
            <DatasetState query={teamDay} onPickLeague={onPickLeague}>
              {(data) => (
                <TeamDayList day={data} isToday={date === today} onOpenPlayer={setOpenPlayer} />
              )}
            </DatasetState>
          )}
        </CardContent>
      </Card>
      <PlayerDetailSheet
        leagueKey={leagueKey}
        player={openPlayer}
        viewDate={date ?? today}
        onClose={() => setOpenPlayer(null)}
        onPickLeague={onPickLeague}
      />
    </div>
  );
}
