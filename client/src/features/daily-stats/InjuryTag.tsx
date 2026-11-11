import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { yahooPlayerUrl } from "./player-detail-model";

/**
 * Yahoo's injury designation as Yahoo writes it (GTD, Q, O, DTD…), linking to
 * the player's Yahoo page for the note. It is today's status, so screens show
 * it only on today's views, never against a past date.
 */
export function InjuryTag({ player }: { player: DailyPlayer }) {
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
      className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-md border border-destructive px-1.5 text-xs font-semibold text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {injury.designation}
    </a>
  );
}
