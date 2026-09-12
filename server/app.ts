import express, { type Express } from "express";
import session, { type Store } from "express-session";
import { env } from "./config/env";
import { passport } from "./config/auth";
import { requestLogger } from "./middleware/request-logger";
import { registerRoutes } from "./routes/index";
import { logger } from "./utils/logger";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export interface CreateAppOptions {
  sessionStore?: Store;
}

/**
 * Build the HTTP application without opening a listener or attaching a client
 * asset server. This keeps route initialization reusable in local Node and
 * request-driven serverless runtimes.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  return configureApp(app, options);
}

/** Configure an Express instance with the complete application API. */
export function configureApp(
  app: Express,
  options: CreateAppOptions = {},
): Express {
  app.disable("x-powered-by");

  if (env.NODE_ENV === "production" || env.TRUST_PROXY) {
    app.set("trust proxy", 1);
    logger.info("Trust proxy enabled (running behind reverse proxy)");
  }

  app.use(
    session({
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: options.sessionStore,
      cookie: {
        secure: env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);

  registerRoutes(app);

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "API route not found",
      code: "NOT_FOUND",
    });
  });

  return app;
}
