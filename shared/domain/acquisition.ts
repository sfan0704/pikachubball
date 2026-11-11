/**
 * How a player came to be on a team: the latest move that brought them there,
 * else the draft pick, as the data reference's "Latest acquisition" rule says.
 */

/** Where a player moved from or to. */
export type MovePlace =
  | { readonly kind: "freeAgents" }
  | { readonly kind: "waivers" }
  | { readonly kind: "team"; readonly teamKey: string };

/** One player's part in a move. */
export interface PlayerMove {
  readonly playerKey: string;
  readonly from: MovePlace;
  readonly to: MovePlace;
}

/** A successful move: an add, drop or trade, with the FAAB bid on a waiver claim. */
export interface TeamMove {
  readonly waiverBid: number | null;
  readonly players: readonly PlayerMove[];
}

/** One draft pick. */
export interface DraftPick {
  readonly round: number;
  readonly teamKey: string;
  readonly playerKey: string;
  /** The auction price; null in a snake draft. */
  readonly cost: number | null;
}

/** The league's draft. */
export interface DraftResults {
  readonly isAuction: boolean;
  readonly picks: readonly DraftPick[];
}

/** How a player joined their current team. */
export type Acquisition =
  | { readonly kind: "drafted"; readonly round: number }
  | { readonly kind: "auction"; readonly cost: number }
  | { readonly kind: "waivers"; readonly bid: number | null }
  | { readonly kind: "freeAgent" }
  | { readonly kind: "trade" }
  | { readonly kind: "unknown" };

const UNKNOWN: Acquisition = { kind: "unknown" };

function fromDraft(playerKey: string, teamKey: string, draft: DraftResults): Acquisition {
  const pick = draft.picks.find(
    (candidate) => candidate.playerKey === playerKey && candidate.teamKey === teamKey
  );
  if (!pick) {
    return UNKNOWN;
  }
  if (draft.isAuction) {
    return pick.cost === null ? UNKNOWN : { kind: "auction", cost: pick.cost };
  }
  return { kind: "drafted", round: pick.round };
}

function fromMove(move: TeamMove, part: PlayerMove, teamKey: string): Acquisition {
  if (part.to.kind !== "team" || part.to.teamKey !== teamKey) {
    // The latest move took the player away, so the roster and the moves disagree.
    return UNKNOWN;
  }
  switch (part.from.kind) {
    case "waivers":
      return { kind: "waivers", bid: move.waiverBid };
    case "freeAgents":
      return { kind: "freeAgent" };
    case "team":
      return { kind: "trade" };
  }
}

/**
 * How a player on a team got there. `moves` are the team's successful moves,
 * newest first. The newest move that names the player decides; with none, a
 * pick of the player by this team means drafted; otherwise it is unknown.
 */
export function latestAcquisition(
  playerKey: string,
  teamKey: string,
  moves: readonly TeamMove[],
  draft: DraftResults
): Acquisition {
  for (const move of moves) {
    const part = move.players.find((candidate) => candidate.playerKey === playerKey);
    if (part) {
      return fromMove(move, part, teamKey);
    }
  }
  return fromDraft(playerKey, teamKey, draft);
}
