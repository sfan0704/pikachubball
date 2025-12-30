// Load and validate environment variables first
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { env } from "./config/env";

import express from "express";
import session from "express-session";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic } from "./config/vite";
import { passport } from "./config/auth";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error-handler";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Trust proxy settings
// Enable trust proxy in production or when explicitly set (e.g., for ngrok)
if (env.NODE_ENV === "production" || env.TRUST_PROXY) {
  app.set("trust proxy", true);
  logger.info("Trust proxy enabled (running behind reverse proxy)");
}

// Session configuration (using validated env)
const SESSION_SECRET = env.SESSION_SECRET;

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
import { requestLogger } from "./middleware/request-logger";
app.use(requestLogger);

(async () => {
  const server = await registerRoutes(app);

  // Error handler must be last middleware (after all routes)
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = env.PORT;
  server.listen(port, "0.0.0.0", () => {
    logger.info(`serving on port ${port}`);
  });
})();
