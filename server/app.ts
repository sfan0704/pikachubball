import express, { type Express } from "express";
import { AUTH_NO_STORE_HEADERS } from "./auth/supabase-auth";
import { requestId } from "./middleware/request-id";
import { createRequestLogger } from "./middleware/request-logger";
import { NotFoundError } from "../shared/api/errors";
import { registerRoutes } from "./routes/index";
import type { ServerDependencies } from "./dependencies";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

/**
 * Build the HTTP application without opening a listener or attaching a client
 * asset server. This keeps route initialization reusable in local Node and
 * request-driven serverless runtimes.
 */
export function createApp(dependencies: ServerDependencies): Express {
  const app = express();
  return configureApp(app, dependencies);
}

/** Configure an Express instance with the complete application API. */
export function configureApp(app: Express, dependencies: ServerDependencies): Express {
  const { config, logger } = dependencies;
  app.disable("x-powered-by");
  app.use(requestId);

  if (config.trustProxy) {
    app.set("trust proxy", 1);
    logger.info("Trust proxy enabled (running behind reverse proxy)");
  }

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: false }));
  app.use(createRequestLogger(logger));

  // Every API response is per-user or auth-related. Without an explicit header
  // Vercel sends "public, max-age=0, must-revalidate", so make them private and
  // uncacheable by default; a route may still set its own header.
  app.use("/api", (_req, res, next) => {
    res.set(AUTH_NO_STORE_HEADERS);
    next();
  });

  registerRoutes(app, dependencies);

  app.use("/api", (_req, _res, next) => {
    next(new NotFoundError("API route"));
  });

  return app;
}
