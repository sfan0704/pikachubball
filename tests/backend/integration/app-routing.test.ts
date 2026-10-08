import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app";
import { serveStatic } from "../../../server/config/vite";
import { createAppErrorHandler } from "../../../server/composition-root";
import { buildTestDependencies } from "../../support/dependencies";

const dependencies = buildTestDependencies();
const APP_ORIGIN = dependencies.config.auth.appOrigin;
const errorHandler = createAppErrorHandler(dependencies);

function createApiApp() {
  const app = createApp(dependencies);
  app.use(errorHandler);
  return app;
}

let staticFixturePath: string;

function createProductionApp() {
  const app = createApp(dependencies);
  serveStatic(app, staticFixturePath);
  app.use(errorHandler);
  return app;
}

beforeAll(() => {
  staticFixturePath = fs.mkdtempSync(path.join(os.tmpdir(), "pikachubball-static-"));
  fs.mkdirSync(path.join(staticFixturePath, "assets"));
  fs.writeFileSync(
    path.join(staticFixturePath, "index.html"),
    '<div id="root"></div><script type="module" src="/assets/app-a1b2c3.js"></script><link rel="stylesheet" href="/assets/app-d4e5f6.css">'
  );
  fs.writeFileSync(path.join(staticFixturePath, "assets/app-a1b2c3.js"), "export {};");
  fs.writeFileSync(path.join(staticFixturePath, "assets/app-d4e5f6.css"), ":root {}");
});

afterAll(() => {
  fs.rmSync(staticFixturePath, { recursive: true, force: true });
});

describe("application routing", () => {
  it("initializes the real API before the first request", async () => {
    const response = await request(createApiApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({
      status: "ok",
      service: "pikachubball",
      commit: "test-build",
    });
  });

  it("sends the build id on every response", async () => {
    const app = createApiApp();

    const responses = await Promise.all([
      request(app).get("/api/health"),
      request(app).get("/api/does-not-exist"),
      request(app).get("/api/auth/me"),
    ]);

    for (const response of responses) {
      expect(response.headers["x-build-id"]).toBe("test-build");
    }
  });

  it("refuses state-changing requests from another origin or with no origin", async () => {
    const app = createApiApp();

    const [foreign, missing, same] = await Promise.all([
      request(app).post("/api/auth/logout").set("Origin", "https://evil.example.test"),
      request(app).delete("/api/auth/yahoo/disconnect"),
      request(app).post("/api/does-not-exist").set("Origin", APP_ORIGIN),
    ]);

    for (const refused of [foreign, missing]) {
      expect(refused.status).toBe(403);
      expect(refused.body).toEqual({
        code: "FORBIDDEN",
        message: "Cross-origin request refused",
        requestId: expect.any(String),
      });
    }
    // From the app's own origin the request reaches routing.
    expect(same.status).toBe(404);
  });

  it("keeps unknown API routes JSON", async () => {
    const response = await request(createApiApp()).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.type).toBe("application/json");
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
    expect(response.body).toEqual({
      code: "NOT_FOUND",
      message: "API route not found",
      requestId: expect.any(String),
    });
  });

  it("marks every API response private and uncacheable", async () => {
    const app = createApiApp();
    const responses = await Promise.all([
      request(app).get("/api/health"),
      request(app).get("/api/auth/yahoo/status"),
      request(app).get("/api/yahoo/leagues"),
      request(app).get("/api/does-not-exist"),
    ]);

    for (const response of responses) {
      expect(response.headers["cache-control"]).toBe(
        "private, no-cache, no-store, must-revalidate, max-age=0"
      );
      expect(response.headers.pragma).toBe("no-cache");
    }
  });

  it("does not register excluded chat, schedule, AI credential or debug endpoints", async () => {
    const app = createApiApp();
    const responses = await Promise.all([
      request(app).get("/api/yahoo/test-auth"),
      request(app).post("/api/chat/message").set("Origin", APP_ORIGIN).send({ message: "hello" }),
      request(app).get("/api/viz/schedule/466.l.1/466.l.1.t.1"),
      request(app)
        .post("/api/settings/openai")
        .set("Origin", APP_ORIGIN)
        .send({ apiKey: "synthetic" }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        code: "NOT_FOUND",
        message: "API route not found",
        requestId: expect.any(String),
      });
    }
  });

  it("passes route failures through the application error handler", async () => {
    const response = await request(createApiApp()).get("/api/auth/callback");

    expect(response.status).toBe(400);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Missing authorization code",
      requestId: expect.any(String),
    });
  });

  it("serves the built app shell for root and retained deep links", async () => {
    const app = createProductionApp();

    const [root, deepLink] = await Promise.all([
      request(app).get("/"),
      request(app).get("/rankings?league=synthetic"),
    ]);

    for (const response of [root, deepLink]) {
      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
      expect(response.text).toContain('<div id="root"></div>');
      expect(response.text).not.toContain("localhost");
    }
  });

  it("serves hashed assets and does not disguise asset misses as HTML", async () => {
    const app = createProductionApp();
    const indexHtml = fs.readFileSync(path.join(staticFixturePath, "index.html"), "utf8");
    const scriptPath = indexHtml.match(/<script[^>]+src="([^"]+)"/)?.[1];
    const stylesheetPath = indexHtml.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];

    expect(scriptPath).toBeTruthy();
    expect(stylesheetPath).toBeTruthy();
    if (!scriptPath || !stylesheetPath) {
      throw new Error("Built index is missing its script or stylesheet");
    }

    const [script, stylesheet, missing] = await Promise.all([
      request(app).get(scriptPath),
      request(app).get(stylesheetPath),
      request(app).get("/assets/missing.js"),
    ]);

    expect(script.status).toBe(200);
    expect(script.type).toMatch(/javascript/);
    expect(stylesheet.status).toBe(200);
    expect(stylesheet.type).toBe("text/css");
    expect(missing.status).toBe(404);
    expect(missing.type).toBe("text/plain");
  });

  it("handles concurrent requests without opening an application listener", async () => {
    const app = createApiApp();
    const responses = await Promise.all(
      Array.from({ length: 14 }, () => request(app).get("/api/health"))
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
  });
});
