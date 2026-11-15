import type { TeamTable } from "@shared/domain";
import { ErrorScreen } from "@/features/league/ErrorScreen";
import {
  allPlayCells,
  luckLines,
  showsCategoryAllPlay,
  teamSummary,
} from "./league-explanation-model";
import type { AllPlayState } from "./useLeagueAllPlay";

interface TeamStandingProps {
  table: TeamTable;
  teamKey: string;
  allPlay: AllPlayState;
  onPickLeague: () => void;
}

/** Standing, All-play and Luck side by side, each with the record or unit behind it. */
function SummaryStrip({ table, teamKey, allPlay }: Omit<TeamStandingProps, "onPickLeague">) {
  return (
    <dl className="grid grid-cols-3 gap-1.5" data-testid="team-summary">
      {teamSummary(table, allPlay.table, teamKey).map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-0.5 rounded-[10px] bg-[#F9FAFB] px-2.5 py-2 dark:bg-muted"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-[17px] font-extrabold leading-tight tabular-nums">{item.value}</dd>
          <dd className="text-xs text-muted-foreground tabular-nums">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The luck sum with the team's own numbers; left out until all-play is known. */
function LuckMath({ table, teamKey, allPlay }: Omit<TeamStandingProps, "onPickLeague">) {
  const lines = luckLines(table, allPlay.table, teamKey);
  if (lines === null) {
    return null;
  }
  return (
    <section
      aria-label="How luck is worked out"
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 rounded-[10px] bg-[#F9FAFB] p-2.5 text-xs text-[#374151] dark:bg-muted dark:text-foreground"
      data-testid="luck-math"
    >
      <p className="col-span-full pb-0.5 text-[11px] text-[#4B5563] dark:text-muted-foreground">
        Luck = real category wins − wins all-play expects
      </p>
      {lines.map((line) => (
        <div key={line.label} className="contents" data-testid="luck-line">
          <span>{line.label}</span>
          <span className="text-muted-foreground">{line.how}</span>
          <b className="text-right font-extrabold tabular-nums text-[#15181D] dark:text-foreground">
            {line.value}
          </b>
        </div>
      ))}
    </section>
  );
}

/**
 * The top of a team sheet: the Standing | All-play | Luck strip and the luck
 * worked out step by step. A failed all-play load says so here with a retry.
 */
export function TeamStanding({ table, teamKey, allPlay, onPickLeague }: TeamStandingProps) {
  return (
    <>
      {allPlay.error && (
        <ErrorScreen
          inline
          error={allPlay.error}
          onRetry={allPlay.retry}
          onPickLeague={onPickLeague}
        />
      )}
      <SummaryStrip table={table} teamKey={teamKey} allPlay={allPlay} />
      <LuckMath table={table} teamKey={teamKey} allPlay={allPlay} />
    </>
  );
}

/**
 * A team's all-play W–L–T in each of the league's categories. Shown only for
 * periods longer than one week; within a week the ranks already say the same.
 */
export function CategoryAllPlay({
  table,
  teamKey,
  allPlay,
}: Omit<TeamStandingProps, "onPickLeague">) {
  if (!showsCategoryAllPlay(table) || allPlay.table === null) {
    return null;
  }
  return (
    <section aria-labelledby="category-all-play" className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <h3 id="category-all-play" className="text-sm font-bold">
          All-play by category
        </h3>
        <span className="text-xs text-muted-foreground">week by week</span>
      </div>
      <ul className="grid grid-cols-3 gap-1.5" data-testid="category-all-play">
        {allPlayCells(table, allPlay.table, teamKey).map((cell) => (
          <li
            key={cell.statId}
            className="flex flex-col items-center rounded-[10px] bg-[#F9FAFB] py-1.5 dark:bg-muted"
          >
            <span className="text-xs">{cell.label}</span>
            <span className="text-sm font-bold tabular-nums">{cell.record}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
