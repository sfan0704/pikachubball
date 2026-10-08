import type { NextFunction, Request, Response } from "express";

/**
 * Sends the deployed build id on every response. The client compares it with
 * its own, and reloads after its current action when they differ, so an old
 * tab never keeps talking to a newer API.
 */
export function createBuildIdHeader(buildId: string) {
  return function buildIdHeader(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader("X-Build-Id", buildId);
    next();
  };
}
