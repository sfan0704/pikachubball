import type { StatLine } from "../../shared/domain";

/** One player's projected totals over the next days, with the games they cover. */
export interface PlayerProjection {
  readonly playerKey: string;
  readonly games: number;
  readonly line: StatLine;
}

/**
 * Where "Next 7 projected" would come from. Nothing implements it until
 * FAN-94 picks a source; `GET /api/me` reports projections off while it isn't wired.
 */
export interface ProjectionSource {
  /** Projections for the listed players over the `days` days starting `from` (US Eastern). */
  getProjections(
    leagueKey: string,
    playerKeys: readonly string[],
    from: string,
    days: number
  ): Promise<PlayerProjection[]>;
}
