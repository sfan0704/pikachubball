import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Request logging middleware
 * Logs API requests with method, path, status, and duration
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Capture response JSON for logging
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logMessage = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logMessage += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logMessage.length > 80) {
        logMessage = logMessage.slice(0, 79) + "…";
      }

      logger.info(logMessage);
    }
  });

  next();
}

