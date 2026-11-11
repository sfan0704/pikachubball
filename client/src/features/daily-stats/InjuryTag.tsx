import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { cn } from "@/lib/utils";
import { yahooPlayerUrl } from "./player-detail-model";

/**
 * Yahoo's injury designation as Yahoo writes it (GTD, Q, O, DTD…), linking to
 * the player's Yahoo page for the note. It is today's status, so screens show
 * it only on today's views, never against a past date.
 */
export function InjuryTag({ player, compact = false }: { player: DailyPlayer; compact?: boolean }) {
  const injury = player.injuryToday;
  if (injury === null) {
    return null;
  }
  const reason = injury.reason === null ? "" : `, ${injury.reason}`;
  return (
    <a
      href={yahooPlayerUrl(player.playerKey)}
      target="_blank"
      rel="noreferrer"
      aria-label={`${injury.designation}${reason}: injury note on Yahoo (opens in a new tab)`}
      data-testid="injury-tag"
      className={cn(
        "inline-flex shrink-0 min-h-[24px] min-w-[24px] items-center justify-center rounded-md border border-red-700/40 px-1 font-bold text-red-700 dark:border-red-400/40 dark:text-red-400",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "text-[0.625rem]" : "text-xs"
      )}
    >
      {injury.designation}
    </a>
  );
}
