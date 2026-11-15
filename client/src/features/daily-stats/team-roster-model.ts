import type {
  DraftResponse,
  PlayerStatsResponse,
  TeamDayResponse,
  TransactionsResponse,
} from "@shared/api/daily-stats";
import { latestAcquisition, statOf, type Acquisition } from "@shared/domain";
import { UNAVAILABLE } from "@/features/league/categories";

type PlayerTotals = PlayerStatsResponse["players"][number];

/** One player in the team popover. */
export interface RosterLine {
  readonly playerKey: string;
  readonly name: string;
  readonly nbaTeam: string;
  /** Today's designation, for example "GTD"; null when healthy. */
  readonly injury: string | null;
  /** How the player joined the team; null until the moves and the draft have loaded. */
  readonly acquired: string | null;
  /** Season PTS, REB and AST per game; null until the season totals have loaded. */
  readonly averages: string | null;
}

/** The datasets the popover joins; each is undefined until it loads. */
export interface RosterSources {
  readonly roster: TeamDayResponse;
  readonly seasonStats: PlayerStatsResponse | undefined;
  readonly transactions: TransactionsResponse | undefined;
  readonly draft: DraftResponse | undefined;
}

/** An acquisition as the popover words it. */
export function acquisitionText(acquisition: Acquisition): string {
  switch (acquisition.kind) {
    case "drafted":
      return `Round ${acquisition.round}`;
    case "auction":
      return `$${acquisition.cost}`;
    case "waivers":
      return acquisition.bid === null ? "Waivers" : `Waivers $${acquisition.bid}`;
    case "freeAgent":
      return "Free agent";
    case "trade":
      return "Trade";
    case "unknown":
      return "Acquired: unknown";
  }
}

/**
 * The roster's summary line: points, rebounds and assists per game by Yahoo
 * stat id, whatever the league scores, since every NBA fan reads these three.
 */
const SUMMARY_STATS = [
  { statId: "12", label: "PTS" },
  { statId: "15", label: "REB" },
  { statId: "16", label: "AST" },
] as const;

function perGame(totals: PlayerTotals, statId: string, label: string): string {
  const value = statOf(totals.line, statId);
  const text =
    value.kind === "value" && totals.gamesPlayed > 0
      ? (value.value / totals.gamesPlayed).toFixed(1)
      : UNAVAILABLE;
  return `${text} ${label}`;
}

function averagesText(stats: PlayerStatsResponse | undefined, playerKey: string): string | null {
  const totals = stats?.players.find((player) => player.playerKey === playerKey);
  if (!totals) {
    return null;
  }
  return SUMMARY_STATS.map(({ statId, label }) => perGame(totals, statId, label)).join(" · ");
}

/** The team's roster today, in lineup order, with how each player arrived and their season averages. */
export function rosterLines({
  roster,
  seasonStats,
  transactions,
  draft,
}: RosterSources): RosterLine[] {
  return roster.players.map(({ player }) => ({
    playerKey: player.playerKey,
    name: player.name,
    nbaTeam: player.nbaTeam,
    injury: player.injuryToday?.designation ?? null,
    acquired:
      transactions && draft
        ? acquisitionText(
            latestAcquisition(player.playerKey, roster.teamKey, transactions.transactions, draft)
          )
        : null,
    averages: averagesText(seasonStats, player.playerKey),
  }));
}
