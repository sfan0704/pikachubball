import type { WeeksResponse } from "@shared/api/daily-stats";
import { addDays, nbaDateOf } from "@shared/domain";
import { useLocation } from "wouter";
import { useWeeks } from "@/api/daily-stats-hooks";
import { DAY_LABELS, type MatchupDay } from "@/features/league/screens";
import { selectionPath, type Selection } from "@/features/league/selection";
import { useNow } from "@/features/league/useNow";
import { DatasetState } from "./DatasetState";
import { LinkBar } from "./LinkBar";
import { MatchupDayBoard } from "./MatchupDayBoard";
import { MatchupWeekBoard } from "./MatchupWeekBoard";
import { weekFor, weekLabel, type ScoringWeek } from "./week-board";

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

interface WeekViewProps {
  selection: Selection;
  weeks: WeeksResponse["weeks"];
  today: string;
  now: number;
  onPickLeague: () => void;
}

/** The week picker: weeks that have started, newest first. Each choice is a URL. */
function WeekPicker({
  selection,
  weeks,
  shown,
  current,
  today,
}: {
  selection: Selection;
  weeks: WeeksResponse["weeks"];
  shown: ScoringWeek | undefined;
  current: ScoringWeek | undefined;
  today: string;
}) {
  const [, navigate] = useLocation();
  const started = weeks.filter((week) => week.start <= today).reverse();
  const pick = (value: string) => {
    const week = Number(value);
    navigate(selectionPath({ ...selection, scope: week === current?.week ? "current" : week }));
  };
  return (
    <div className="flex items-center justify-end">
      <label htmlFor="matchup-week" className="sr-only">
        Week
      </label>
      <select
        id="matchup-week"
        value={shown?.week ?? ""}
        onChange={(event) => pick(event.target.value)}
        className="min-h-[44px] max-w-full rounded-[10px] border bg-background px-2 text-sm font-semibold"
      >
        {shown === undefined && <option value="">Pick a week</option>}
        {started.map((week) => (
          <option key={week.week} value={week.week}>
            {weekLabel(week)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The Week view: the picker, then the chosen week's board, or why there is none. */
function WeekView({ selection, weeks, today, now, onPickLeague }: WeekViewProps) {
  const current = weekFor(weeks, "current", today);
  const shown = weekFor(weeks, selection.scope, today);
  const missing =
    shown === undefined
      ? selection.scope === "current"
        ? "Today isn't in a scoring week."
        : "This league has no such week."
      : shown.start > today
        ? `Week ${shown.week} hasn't started.`
        : null;
  return (
    <>
      <WeekPicker
        selection={selection}
        weeks={weeks}
        shown={missing === null ? shown : undefined}
        current={current}
        today={today}
      />
      {missing !== null || shown === undefined ? (
        <p className="text-sm text-muted-foreground" role="status" data-testid="matchup-week">
          {missing}
        </p>
      ) : (
        <MatchupWeekBoard
          key={shown.week}
          leagueKey={selection.leagueKey}
          teamKey={selection.teamKey}
          week={shown}
          isCurrentWeek={shown.week === current?.week}
          today={today}
          now={now}
          onPickLeague={onPickLeague}
        />
      )}
    </>
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
        <DatasetState query={weeks} onPickLeague={onPickLeague}>
          {(data) => (
            <WeekView
              selection={selection}
              weeks={data.weeks}
              today={today}
              now={now}
              onPickLeague={onPickLeague}
            />
          )}
        </DatasetState>
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
