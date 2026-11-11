import { gamesLeft, type Score, type TeamRow } from "@shared/domain";

interface MatchupHeaderProps {
  me: TeamRow;
  opponent: TeamRow;
  /** Every other team, for the opponent picker. */
  others: readonly TeamRow[];
  /** Yahoo's opponent this week; null on a bye. */
  realOpponentKey: string | null;
  score: Score;
  onPickOpponent: (teamKey: string) => void;
}

/** "25/36", or "–" until Yahoo's week table carries the team's games. */
function gamesLeftText(team: TeamRow): string {
  if (team.games === null) {
    return "–";
  }
  const { left, total } = gamesLeft(team.games);
  return `${left}/${total}`;
}

/** The week's score so far: wins, losses and ties, plus categories still unknown. */
function ScoreLine({ score }: { score: Score }) {
  return (
    <p className="text-3xl font-extrabold tabular-nums" data-testid="matchup-score">
      {score.wins}–{score.losses}–{score.ties}
      {!score.complete && (
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          {score.unavailable} unknown
        </span>
      )}
    </p>
  );
}

/**
 * The Matchup header: the week's score against the chosen team, each team's
 * games left, and the opponent picker, which starts on Yahoo's opponent.
 */
export function MatchupHeader({
  me,
  opponent,
  others,
  realOpponentKey,
  score,
  onPickOpponent,
}: MatchupHeaderProps) {
  return (
    <div className="space-y-2" data-testid="matchup-header">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{me.teamName}</p>
          <ScoreLine score={score} />
        </div>
        <div className="min-w-0 text-right">
          <label htmlFor="matchup-opponent" className="sr-only">
            Opponent
          </label>
          <select
            id="matchup-opponent"
            value={opponent.teamKey}
            onChange={(event) => onPickOpponent(event.target.value)}
            className="min-h-[44px] max-w-[11rem] truncate rounded-[10px] border bg-background px-2 text-sm font-semibold"
          >
            {others.map((team) => (
              <option key={team.teamKey} value={team.teamKey}>
                {team.teamName}
              </option>
            ))}
          </select>
          {opponent.teamKey !== realOpponentKey && (
            <p className="text-xs text-muted-foreground" data-testid="not-your-matchup">
              Not your matchup
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="games-left">
        Games left <span className="font-semibold text-foreground">{gamesLeftText(me)}</span> vs{" "}
        <span className="font-semibold text-foreground">{gamesLeftText(opponent)}</span>
      </p>
    </div>
  );
}
