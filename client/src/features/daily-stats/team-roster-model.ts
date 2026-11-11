import type {
  DraftResponse,
  PlayerStatsResponse,
  TeamDayResponse,
  TransactionsResponse,
} from "@shared/api/daily-stats";
import { latestAcquisition, perGameAverages, type Acquisition } from "@shared/domain";
import { UNAVAILABLE } from "@/features/league/categories";

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

function perGame(value: number | null, label: string): string {
  return `${value === null ? UNAVAILABLE : value.toFixed(1)} ${label}`;
}

function averagesText(stats: PlayerStatsResponse | undefined, playerKey: string): string | null {
  const totals = stats?.players.find((player) => player.playerKey === playerKey);
  if (!totals) {
    return null;
  }
  const averages = perGameAverages(totals);
  return [
    perGame(averages.pts, "PTS"),
    perGame(averages.reb, "REB"),
    perGame(averages.ast, "AST"),
  ].join(" · ");
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
