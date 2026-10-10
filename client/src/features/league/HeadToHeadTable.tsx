import { CATEGORY_LABELS } from "./categories";
import { RESULT_TEXT, scoreText, type MatchupSummary } from "./matchup-model";

const RESULT_CLASS = {
  win: "bg-green-500/5 text-green-700 dark:text-green-400",
  loss: "bg-red-500/5 text-red-700 dark:text-red-400",
  tie: "bg-yellow-500/5 text-yellow-700 dark:text-yellow-400",
  unavailable: "text-muted-foreground",
} as const;

interface HeadToHeadTableProps {
  myTeamName: string;
  summary: MatchupSummary;
}

/** Two teams category by category; each result is written out as well as coloured. */
export function HeadToHeadTable({ myTeamName, summary }: HeadToHeadTableProps) {
  return (
    <div className="space-y-4">
      <p className="text-center text-3xl font-bold" data-testid="matchup-score">
        {scoreText(summary.score)}
      </p>
      <p className="text-center text-xs text-muted-foreground">wins-losses-ties</p>
      <div
        role="region"
        aria-label="Category comparison"
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">
            {myTeamName} against {summary.opponent.teamName}, category by category
          </caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="text-left py-3 px-2 font-semibold">
                Category
              </th>
              <th scope="col" className="text-center py-3 px-2 font-semibold">
                {myTeamName}
              </th>
              <th scope="col" className="text-center py-3 px-2 font-semibold">
                {summary.opponent.teamName}
              </th>
              <th scope="col" className="text-center py-3 px-2 font-semibold">
                Difference
              </th>
              <th scope="col" className="text-center py-3 px-2 font-semibold">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.lines.map((line) => (
              <tr
                key={line.category}
                className={`border-b ${RESULT_CLASS[line.result]}`}
                data-testid={`matchup-category-${line.category}`}
                data-result={line.result}
              >
                <th scope="row" className="text-left py-3 px-2 font-medium">
                  {CATEGORY_LABELS[line.category]}
                </th>
                <td className="text-center py-3 px-2">{line.mine}</td>
                <td className="text-center py-3 px-2">{line.theirs}</td>
                <td className="text-center py-3 px-2">{line.difference}</td>
                <td className="text-center py-3 px-2 font-semibold">{RESULT_TEXT[line.result]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
