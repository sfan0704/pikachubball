// Load and validate environment variables first
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { env } from "./config/env";
import { createApp } from "./app";
import { createDevServer } from "./config/dev-server";
import { setupVite, serveStatic } from "./config/vite";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error-handler";

const app = createApp();
const server = createDevServer(app);

(async () => {
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Error middleware follows API and client routes.
  app.use(errorHandler);

  const port = env.PORT;
  server.listen(port, "0.0.0.0", () => {
    logger.info(`serving on port ${port}${process.env.DEV_HTTPS_CERT ? " (https)" : ""}`);
  });
})();
