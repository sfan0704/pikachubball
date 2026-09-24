import { execFileSync } from "child_process";
import fs from "fs";
import { Server as HttpServer } from "http";
import https, { Server as HttpsServer } from "https";
import type { AddressInfo } from "net";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDevServer } from "../../../../server/config/dev-server";

let dir: string;
let certFile: string;
let keyFile: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pikachubball-dev-https-"));
  certFile = path.join(dir, "cert.pem");
  keyFile = path.join(dir, "key.pem");
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=localhost", "-keyout", keyFile, "-out", certFile,
  ], { stdio: "ignore" });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const ok = (_req: unknown, res: { end: (body: string) => void }) => res.end("ok");

describe("createDevServer", () => {
  it("serves plain HTTP when no certificate is configured", () => {
    const server = createDevServer(ok as never, { NODE_ENV: "development" });

    expect(server).toBeInstanceOf(HttpServer);
    expect(server).not.toBeInstanceOf(HttpsServer);
  });

  it("serves HTTPS with the configured certificate", async () => {
    const server = createDevServer(ok as never, {
      NODE_ENV: "development",
      DEV_HTTPS_CERT: certFile,
      DEV_HTTPS_KEY: keyFile,
    });
    expect(server).toBeInstanceOf(HttpsServer);

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const body = await new Promise<string>((resolve, reject) => {
        https
          .get({ host: "127.0.0.1", port, path: "/", rejectUnauthorized: false }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
          })
          .on("error", reject);
      });
      expect(body).toBe("ok");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("requires the certificate and key together", () => {
    expect(() =>
      createDevServer(ok as never, { NODE_ENV: "development", DEV_HTTPS_CERT: certFile }),
    ).toThrow("DEV_HTTPS_CERT and DEV_HTTPS_KEY must be set together");
  });

  it("refuses the development certificate in production", () => {
    expect(() =>
      createDevServer(ok as never, {
        NODE_ENV: "production",
        DEV_HTTPS_CERT: certFile,
        DEV_HTTPS_KEY: keyFile,
      }),
    ).toThrow("for local development only");
  });
});
