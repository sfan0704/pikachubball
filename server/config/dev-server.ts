import fs from "fs";
import { createServer as createHttpServer, type RequestListener, type Server } from "http";
import { createServer as createHttpsServer } from "https";

/**
 * Local development can serve HTTPS so Yahoo's Fantasy OAuth, which only
 * accepts https:// redirect URIs, can return to https://localhost. The
 * certificate comes from mkcert (see README). Production runs on Vercel and
 * never uses this.
 */
export function createDevServer(
  app: RequestListener,
  environment: NodeJS.ProcessEnv = process.env,
): Server {
  const certFile = environment.DEV_HTTPS_CERT?.trim();
  const keyFile = environment.DEV_HTTPS_KEY?.trim();

  if (!certFile && !keyFile) {
    return createHttpServer(app);
  }
  if (!certFile || !keyFile) {
    throw new Error("DEV_HTTPS_CERT and DEV_HTTPS_KEY must be set together");
  }
  if (environment.NODE_ENV === "production") {
    throw new Error("DEV_HTTPS_CERT/DEV_HTTPS_KEY are for local development only");
  }

  return createHttpsServer(
    { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) },
    app,
  ) as unknown as Server;
}
