import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { RequestScope } from "../request-context";
import type { Clock } from "../utils/clock";
import type { Logger } from "../utils/logger";

/** What the request scope needs from the composition root. */
export interface RequestScopeDependencies {
  readonly logger: Logger;
  readonly clock: Clock;
}

/**
 * Gives every request an id (returned in X-Request-Id), a logger that carries
 * it, and a Yahoo call counter, then writes one structured line when the
 * response finishes: id, method, route pattern, status, duration and Yahoo calls.
 * It logs the route pattern, never the URL or any body, so ids and tokens stay out.
 */
export function createRequestScope({ logger, clock }: RequestScopeDependencies) {
  return function requestScope(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const scope: RequestScope = {
      requestId,
      logger: logger.child({ requestId }),
      yahooCalls: { count: 0 },
    };
    req.scope = scope;
    res.setHeader("X-Request-Id", requestId);

    const start = clock.now();
    res.on("finish", () => {
      if (!req.originalUrl.startsWith("/api")) {
        return;
      }
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : "unmatched";
      scope.logger.info("request", {
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: clock.now() - start,
        yahooCalls: scope.yahooCalls.count,
      });
    });

    next();
  };
}
