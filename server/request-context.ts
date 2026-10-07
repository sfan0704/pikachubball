import type { Request } from "express";
import { UnauthorizedError } from "../shared/api/errors";
import type { YahooSessionIdentity } from "./auth/supabase-auth";
import type { YahooApiClient } from "./services/yahoo/yahoo-api-client";
import type { OwnerScopedStorage } from "./storage/yahoo-token-storage";
import type { Clock } from "./utils/clock";
import type { Logger } from "./utils/logger";

/** What every request has, signed in or not. */
export interface RequestScope {
  readonly requestId: string;
  /** Carries the request id on every line. */
  readonly logger: Logger;
  /** Yahoo HTTP attempts made for this request; logged when it finishes. */
  readonly yahooCalls: { count: number };
}

/** Everything a signed-in request needs, built once by the auth middleware and passed explicitly. */
export interface RequestContext extends RequestScope {
  readonly user: YahooSessionIdentity;
  readonly storage: OwnerScopedStorage;
  readonly clock: Clock;
  /** The request's one Yahoo client, created on first use so a request that never calls Yahoo never reads tokens. */
  yahooClient(): Promise<YahooApiClient>;
}

/** Provides a Yahoo client; the services take this instead of building clients. */
export type YahooClientProvider = () => Promise<YahooApiClient>;

declare module "express-serve-static-core" {
  interface Request {
    scope?: RequestScope;
    context?: RequestContext;
  }
}

/** The request's context, or UNAUTHORIZED when it didn't pass the auth middleware. */
export function getRequestContext(req: Request): RequestContext {
  if (!req.context) {
    throw new UnauthorizedError("User not authenticated");
  }
  return req.context;
}

/** How the context makes its Yahoo client. */
export type YahooClientCreator = (
  userId: string,
  storage: OwnerScopedStorage,
  onRequest: () => void
) => Promise<YahooApiClient>;

/** Builds the context for a verified user; the Yahoo client is memoized per request. */
export function createRequestContext(options: {
  scope: RequestScope;
  user: YahooSessionIdentity;
  storage: OwnerScopedStorage;
  clock: Clock;
  createYahooClient: YahooClientCreator;
}): RequestContext {
  const { scope, user, storage, clock, createYahooClient } = options;
  let client: Promise<YahooApiClient> | undefined;
  return {
    ...scope,
    user,
    storage,
    clock,
    yahooClient: () => {
      client ??= createYahooClient(user.userId, storage, () => {
        scope.yahooCalls.count += 1;
      });
      return client;
    },
  };
}
