// Load and validate environment variables first
import { config as loadDotenv } from "dotenv";
import { resolve } from "path";
loadDotenv({ path: resolve(process.cwd(), ".env.local") });

import { createApp } from "./http/app";
import { createAppErrorHandler, createServerDependencies } from "./http/composition-root";
import { loadConfig } from "./config/config";
import { createDevServer } from "./config/dev-server";
import { setupVite, serveStatic } from "./config/vite";

const config = loadConfig();
const dependencies = createServerDependencies(config);
const { logger } = dependencies;
const app = createApp(dependencies);
const server = createDevServer(app);

async function main(): Promise<void> {
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Error middleware follows API and client routes.
  app.use(createAppErrorHandler(dependencies));

  const port = config.port;
  server.listen(port, "0.0.0.0", () => {
    logger.info(`serving on port ${port}${process.env.DEV_HTTPS_CERT ? " (https)" : ""}`);
  });
}

main().catch((error: unknown) => {
  logger.error("The server failed to start", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  process.exit(1);
});
