import type { TeamTable } from "@shared/domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { explanationItems } from "./league-explanation-model";
import { useLeagueAllPlay } from "./useLeagueAllPlay";

/** The period's table and whose numbers the ⓘ shows. */
export interface ExplainedLeague {
  table: TeamTable;
  leagueKey: string;
  myTeamKey: string;
}

function Terms({ items }: { items: ReturnType<typeof explanationItems> }) {
  return (
    <dl className="divide-y divide-border">
      {items.map((item) => (
        <div key={item.term} className="flex flex-col gap-1 py-2.5" data-testid="explanation-term">
          <dt className="text-sm font-bold">{item.term}</dt>
          <dd className="text-sm leading-relaxed">{item.text}</dd>
          {item.yours && (
            <dd className="text-sm font-semibold tabular-nums text-[#1E3A8A] dark:text-blue-300">
              {item.yours}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/** The terms with the viewer's numbers; mounted only while the ⓘ is open, so all-play loads only then. */
function TermsWithNumbers({ league }: { league: ExplainedLeague }) {
  const allPlay = useLeagueAllPlay(league.table, league.leagueKey);
  return <Terms items={explanationItems(league.table, allPlay.table, league.myTeamKey)} />;
}

/**
 * The round ⓘ next to the League period picker: the one place W–L–T, all-play,
 * luck and category ranks are explained, each with the viewer's own numbers.
 * Pass a null league while the period's table loads; the terms then show alone.
 */
export function LeagueExplanation({ league }: { league: ExplainedLeague | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="How to read this"
          className="size-8 shrink-0 rounded-full border border-[#9CA3AF] text-[11px] font-bold text-[#374151] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:text-foreground"
        >
          i
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 text-base font-bold">How to read League</DialogTitle>
        <DialogDescription className="sr-only">
          What W–L–T, all-play, luck and category ranks mean, with your numbers.
        </DialogDescription>
        {league === null ? (
          <Terms items={explanationItems(null, null, "")} />
        ) : (
          <TermsWithNumbers league={league} />
        )}
        <p className="text-sm text-muted-foreground">
          Tied teams share a rank and the next one is skipped (1, 1, 3).
        </p>
      </DialogContent>
    </Dialog>
  );
}
