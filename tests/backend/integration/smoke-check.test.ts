import { execFile } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { promisify } from "node:util";
import express, { type Express } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/http/app";
import { createAppErrorHandler } from "../../../server/http/composition-root";
import { buildTestConfig, buildTestDependencies } from "../../support/dependencies";

const run = promisify(execFile);
const servers: Server[] = [];

async function serve(app: Express): Promise<string> {
  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** The real app (health, protected routes, security headers) plus the single-page client. */
function healthyApp(): Express {
  const dependencies = buildTestDependencies({ config: buildTestConfig({ buildId: "abc123" }) });
  const app = createApp(dependencies);
  app.get(["/auth", /^\/leagues\/.*/], (_req, res) => {
    res.type("html").send('<!doctype html><div id="root"></div>');
  });
  app.use(createAppErrorHandler(dependencies));
  return app;
}

async function smoke(url: string, commit?: string) {
  try {
    const { stdout } = await run("node", [
      "scripts/smoke-check.mjs",
      url,
      ...(commit ? [commit] : []),
    ]);
    return { code: 0, output: stdout };
  } catch (error) {
    const failure = error as { code: number; stdout: string; stderr: string };
    return { code: failure.code, output: failure.stdout + failure.stderr };
  }
}

afterEach(() => Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r)))));

describe("scripts/smoke-check.mjs", () => {
  it("passes for a healthy deployment of the expected commit", async () => {
    const result = await smoke(await serve(healthyApp()), "abc123");

    expect(result.output).not.toContain("FAIL");
    expect(result.code).toBe(0);
    expect(result.output).toContain("ok    health reports the expected commit");
    expect(result.output).toContain("ok    security headers are present");
  });

  it("fails when the deployed commit is not the expected one", async () => {
    const result = await smoke(await serve(healthyApp()), "def456");

    expect(result.code).toBe(1);
    expect(result.output).toContain("deployed commit is abc123, expected def456");
  });

  it("fails when a protected route answers an anonymous request", async () => {
    const app = healthyApp();
    const broken = express();
    broken.get("/api/me", (_req, res) => res.json({ user: "anyone" }));
    broken.use(app);
    const result = await smoke(await serve(broken));

    expect(result.code).toBe(1);
    expect(result.output).toContain("/api/me answered 200 to an anonymous request");
  });

  it("fails when the app or the security headers are missing", async () => {
    const bare = express();
    bare.get("/api/health", (_req, res) => res.json({ status: "ok", commit: "abc123" }));
    const result = await smoke(await serve(bare));

    expect(result.code).toBe(1);
    expect(result.output).toContain("FAIL  protected routes refuse an anonymous request");
    expect(result.output).toContain("FAIL  deep links load the app");
    expect(result.output).toContain("FAIL  security headers are present");
  });

  it("needs a URL", async () => {
    const result = await smoke("");

    expect(result.code).toBe(2);
  });
});
