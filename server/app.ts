import express, { type Express } from "express";
import { AUTH_NO_STORE_HEADERS } from "./auth/supabase-auth";
import { env } from "./config/env";
import { requestLogger } from "./middleware/request-logger";
import { registerRoutes } from "./routes/index";
import { logger } from "./utils/logger";

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
export function createApp(): Express {
  const app = express();
  return configureApp(app);
}

/** Configure an Express instance with the complete application API. */
export function configureApp(app: Express): Express {
  app.disable("x-powered-by");

  if (env.NODE_ENV === "production" || env.TRUST_PROXY) {
    app.set("trust proxy", 1);
    logger.info("Trust proxy enabled (running behind reverse proxy)");
  }

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);

  // Every API response is per-user or auth-related. Without an explicit header
  // Vercel sends "public, max-age=0, must-revalidate", so make them private and
  // uncacheable by default; a route may still set its own header.
  app.use("/api", (_req, res, next) => {
    res.set(AUTH_NO_STORE_HEADERS);
    next();
  });

  registerRoutes(app);

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "API route not found",
      code: "NOT_FOUND",
    });
  });

  return app;
}
