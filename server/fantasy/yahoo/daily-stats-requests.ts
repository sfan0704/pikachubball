import { AppError, NotFoundError } from "../../../shared/api/errors";
import type { Logger } from "../../utils/logger";
import type { YahooRequester } from "../league-resources";
import { providerStatus, YahooUnavailableError } from "./yahoo-request-policy";

/** Yahoo lists at most 25 players a call. */
export const PLAYER_KEYS_PER_CALL = 25;

/** Splits keys into chunks of `size`, keeping their order. */
export function chunkKeys<T>(keys: readonly T[], size: number = PLAYER_KEYS_PER_CALL): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < keys.length; start += size) {
    chunks.push(keys.slice(start, start + size));
  }
  return chunks;
}

/**
 * A failure as one of the API's codes. Policy errors (rate limited,
 * unavailable, reconnect) already have one; Yahoo saying the resource doesn't
 * exist is NOT_FOUND; anything else Yahoo answered with is YAHOO_UNAVAILABLE.
 */
function asAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const status = providerStatus(error);
  return status === 400 || status === 404
    ? new NotFoundError("Yahoo resource")
    : new YahooUnavailableError();
}

/**
 * The Yahoo calls of one API request for the daily-stats source. Identical
 * paths are fetched once per request, player lists are split into parallel
 * calls of 25, and each call writes one log line naming its resource (never
 * the path, which holds keys).
 */
export class DailyStatsRequests {
  private readonly calls = new Map<string, Promise<unknown>>();

  constructor(
    private readonly requester: () => Promise<YahooRequester>,
    private readonly logger: Logger,
    private readonly clock: { now(): number }
  ) {}

  /** Yahoo's body for `path`, fetched at most once in this request. */
  get(resource: string, path: string): Promise<unknown> {
    let call = this.calls.get(path);
    if (call === undefined) {
      call = this.fetch(resource, path);
      this.calls.set(path, call);
    }
    return call;
  }

  /** One call per 25 player keys, run in parallel; bodies come back in key order. */
  getForPlayers(
    resource: string,
    playerKeys: readonly string[],
    pathFor: (chunk: readonly string[]) => string
  ): Promise<unknown[]> {
    return Promise.all(chunkKeys(playerKeys).map((chunk) => this.get(resource, pathFor(chunk))));
  }

  private async fetch(resource: string, path: string): Promise<unknown> {
    const start = this.clock.now();
    try {
      const body = await (await this.requester()).get(path);
      this.logger.info("yahoo call", { resource, outcome: "ok", durationMs: this.since(start) });
      return body;
    } catch (error) {
      const failure = asAppError(error);
      this.logger.warn("yahoo call", {
        resource,
        outcome: failure.code,
        status: providerStatus(error),
        durationMs: this.since(start),
      });
      throw failure;
    }
  }

  private since(start: number): number {
    return this.clock.now() - start;
  }
}
