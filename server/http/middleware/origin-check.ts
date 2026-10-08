import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../../shared/api/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Refuses requests that change state unless their Origin header is exactly the
 * app's own origin. Browsers always send Origin on such requests, so together
 * with SameSite=Lax cookies this blocks cross-site request forgery. A request
 * with no Origin (not a browser) is refused too.
 */
export function createOriginCheck(appOrigin: string) {
  return function originCheck(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    if (req.get("origin") !== appOrigin) {
      next(new ForbiddenError("Cross-origin request refused"));
      return;
    }
    next();
  };
}
