import {
  compareWithAll,
  headToHead,
  officialResult,
  opponentOf,
  type CategoryComparison,
  type CategoryKey,
  type CategoryResult,
  type HeadToHead,
  type OfficialResult,
  type Score,
  type TeamRow,
  type TeamTable,
} from "@shared/domain";
import { formatTotal, UNAVAILABLE } from "./categories";

export const RESULT_TEXT: Record<CategoryResult, string> = {
  win: "Win",
  loss: "Loss",
  tie: "Tie",
  unavailable: "Unavailable",
};

export const OFFICIAL_TEXT: Record<OfficialResult, string> = {
  win: "Yahoo's result: you won",
  loss: "Yahoo's result: you lost",
  tie: "Yahoo's result: tied",
  undecided: "Yahoo hasn't declared a winner yet",
};

/** "5-3-1", with the number of categories that couldn't be decided when some can't. */
export function scoreText(score: Score): string {
  const base = `${score.wins}-${score.losses}-${score.ties}`;
  return score.complete ? base : `${base} (${score.unavailable} unavailable)`;
}

/** The signed gap between two teams in a category, in the category's own unit. */
export function differenceText(comparison: CategoryComparison): string {
  if (comparison.difference === null) {
    return UNAVAILABLE;
  }
  const sign = comparison.difference > 0 ? "+" : "";
  if (comparison.category === "fgPct" || comparison.category === "ftPct") {
    return `${sign}${(comparison.difference * 100).toFixed(1)}%`;
  }
  return `${sign}${comparison.difference}`;
}

export interface MatchupLine {
  readonly category: CategoryKey;
  readonly mine: string;
  readonly theirs: string;
  readonly difference: string;
  readonly result: CategoryResult;
}

export interface MatchupSummary {
  readonly opponent: TeamRow;
  readonly lines: readonly MatchupLine[];
  readonly score: Score;
}

function teamIn(table: TeamTable, teamKey: string): TeamRow | undefined {
  return table.teams.find((team) => team.teamKey === teamKey);
}

/** A head-to-head ready to show, with each side's total formatted like the rankings table. */
export function summarize(
  table: TeamTable,
  myTeamKey: string,
  opponentKey: string
): MatchupSummary | null {
  const mine = teamIn(table, myTeamKey);
  const opponent = teamIn(table, opponentKey);
  const result = headToHead(table, myTeamKey, opponentKey);
  if (!mine || !opponent || !result) {
    return null;
  }
  return {
    opponent,
    score: result.score,
    lines: result.categories.map((comparison) => ({
      category: comparison.category,
      mine: formatTotal(mine.totals, comparison.category, true),
      theirs: formatTotal(opponent.totals, comparison.category, true),
      difference: differenceText(comparison),
      result: comparison.result,
    })),
  };
}

/** This week's opponent from Yahoo's pairings and Yahoo's own result; null for a season table or a bye. */
export function currentMatchup(table: TeamTable, myTeamKey: string) {
  const opponentKey = opponentOf(table, myTeamKey);
  const summary = opponentKey === null ? null : summarize(table, myTeamKey, opponentKey);
  return summary ? { summary, official: officialResult(table, myTeamKey) } : null;
}

export interface ComparisonRow {
  readonly opponent: TeamRow;
  readonly record: string;
  readonly wins: number;
  readonly complete: boolean;
}

/** My team against every other team, best record first; undecidable comparisons are marked, not guessed. */
export function comparisonRows(table: TeamTable, myTeamKey: string): ComparisonRow[] {
  const byTeam = new Map(table.teams.map((team) => [team.teamKey, team]));
  return compareWithAll(table, myTeamKey)
    .flatMap((result: HeadToHead) => {
      const opponent = byTeam.get(result.opponentTeamKey);
      return opponent
        ? [
            {
              opponent,
              record: scoreText(result.score),
              wins: result.score.wins,
              complete: result.score.complete,
            },
          ]
        : [];
    })
    .sort((a, b) => b.wins - a.wins);
}
