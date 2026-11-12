import { useState } from "react";
import { gamesPlayed, type Score, type TeamRow } from "@shared/domain";

interface ScoreCardProps {
  me: TeamRow;
  opponent: TeamRow;
  /** Every other team, for the opponent picker. */
  others: readonly TeamRow[];
  /** Yahoo's opponent this week; null on a bye. */
  realOpponentKey: string | null;
  score: Score;
  onPickOpponent: (teamKey: string) => void;
}

/** One team's games played as "19/41", or "–" until Yahoo's week table carries the team's games. */
function GamesPlayedValue({ team }: { team: TeamRow }) {
  if (team.games === null) {
    return <b className="text-white">–</b>;
  }
  const { played, total } = gamesPlayed(team.games);
  return (
    <span>
      <b className="text-white">{played}</b>/{total}
    </span>
  );
}

/** The week's score so far: wins, losses and ties, plus categories still unknown. */
function ScoreLine({ score }: { score: Score }) {
  const dash = <span className="px-[3px] text-lg text-[#9CA3AF]">–</span>;
  return (
    <div className="text-center">
      <p
        className="whitespace-nowrap text-[26px] font-extrabold tracking-[-0.5px] tabular-nums"
        data-testid="matchup-score"
      >
        {score.wins}
        {dash}
        {score.losses}
        {dash}
        {score.ties}
      </p>
      {!score.complete && <p className="text-[10px] text-[#C9CED6]">{score.unavailable} unknown</p>}
    </div>
  );
}

/** The opponent picker, which starts on Yahoo's opponent, and a note when it isn't. */
function OpponentPicker({
  opponent,
  others,
  realOpponentKey,
  onPickOpponent,
}: Pick<ScoreCardProps, "opponent" | "others" | "realOpponentKey" | "onPickOpponent">) {
  return (
    <div className="min-w-0 text-right">
      <label htmlFor="matchup-opponent" className="sr-only">
        Opponent
      </label>
      <select
        id="matchup-opponent"
        value={opponent.teamKey}
        onChange={(event) => onPickOpponent(event.target.value)}
        className="min-h-8 w-full max-w-full truncate rounded-[10px] border border-[#D1D5DB] bg-white px-1.5 text-right text-[13px] font-bold text-[#15181D] [text-align-last:right]"
      >
        {others.map((team) => (
          <option key={team.teamKey} value={team.teamKey}>
            {team.teamName}
          </option>
        ))}
      </select>
      {opponent.teamKey !== realOpponentKey && (
        <p className="pt-0.5 text-[11px] text-[#C9CED6]" data-testid="not-your-matchup">
          Not your matchup
        </p>
      )}
    </div>
  );
}

/** Each team's games played this week, as Yahoo shows them, with an ⓘ that explains the numbers. */
function GamesPlayedLine({ me, opponent }: { me: TeamRow; opponent: TeamRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#374151] pt-1.5 text-[11px] text-[#E5E7EB]"
        data-testid="games-played"
      >
        <span>Games played</span>
        <span>
          You <GamesPlayedValue team={me} />
        </span>
        <span className="flex min-w-0 max-w-[45%] gap-1">
          <span className="truncate">{opponent.teamName}</span>
          <GamesPlayedValue team={opponent} />
        </span>
        <button
          type="button"
          aria-label="What games played means"
          aria-expanded={open}
          aria-controls="games-played-info"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto size-6 shrink-0 rounded-full border border-[#6B7280] text-[11px] font-bold text-[#E5E7EB] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
        >
          i
        </button>
      </div>
      {open && (
        <p
          id="games-played-info"
          className="rounded-[10px] bg-[#262A31] p-2 text-[11px] leading-[1.45] text-[#E5E7EB]"
          data-testid="games-played-info"
        >
          <b className="text-white">Games played</b> shows games already played (or under way) / all
          games this week for each team, as Yahoo shows it. Only players in a starting slot count.
        </p>
      )}
    </>
  );
}

/**
 * The dark score card: my team, the week's score against the chosen team and
 * the opponent picker, then each team's games played.
 */
export function ScoreCard({ me, opponent, ...rest }: ScoreCardProps) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-2xl bg-[#15181D] px-3 py-2.5 text-white"
      data-testid="matchup-header"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <p className="truncate text-[13px] font-bold">{me.teamName}</p>
        <ScoreLine score={rest.score} />
        <OpponentPicker opponent={opponent} {...rest} />
      </div>
      <GamesPlayedLine me={me} opponent={opponent} />
    </div>
  );
}

/** The score card's place while the week's table loads, so the sticky block keeps its height. */
export function ScoreCardLoading() {
  return (
    <div
      className="h-[86px] animate-pulse rounded-2xl bg-[#15181D]"
      role="status"
      aria-label="Loading"
    />
  );
}
