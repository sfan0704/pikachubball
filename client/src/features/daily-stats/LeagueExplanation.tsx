import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The round ⓘ next to the League period picker, which explains how the ranks are worked out. */
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
        <DialogTitle className="pr-10 text-base font-bold">Category ranks</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-foreground">
          Every team in the league is ranked in each of the nine categories, using totals for the
          period you pick. 1 is best. The top three are green and the bottom three red. Overall adds
          up each team's category ranks, so a lower total is stronger. W–L–T is the season
          head-to-head record from Yahoo; the ranks are not Yahoo's official standings.
        </DialogDescription>
        <p className="text-sm text-muted-foreground">
          Tied teams share a rank and the next one is skipped (1, 1, 3).
        </p>
      </DialogContent>
    </Dialog>
  );
}
