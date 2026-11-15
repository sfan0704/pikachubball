import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The round ⓘ next to the League period picker, which explains the standings and the ranks. */
export function LeagueExplanation() {
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
        <DialogDescription className="text-sm leading-relaxed text-foreground">
          Standings ranks teams by their official category record for the period you pick (W–L–T),
          with a tie counting as half a win. All-play is where a team would rank if it played every
          other team every week; on Season totals the week in progress counts as it stands. Luck is
          the real category wins minus the wins all-play expects, so plus means the schedule helped.
          Categories ranks every team in each of the league's categories from the period's totals: 1
          is best, the top three are green and the bottom three red.
        </DialogDescription>
        <p className="text-sm text-muted-foreground">
          Tied teams share a rank and the next one is skipped (1, 1, 3).
        </p>
      </DialogContent>
    </Dialog>
  );
}
