import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app";
import { serveStatic } from "../../../server/config/vite";
import { errorHandler } from "../../../server/middleware/error-handler";

function createApiApp() {
  const app = createApp();
  app.use(errorHandler);
  return app;
}

let staticFixturePath: string;

function createProductionApp() {
  const app = createApp();
  serveStatic(app, staticFixturePath);
  app.use(errorHandler);
  return app;
}

beforeAll(() => {
  staticFixturePath = fs.mkdtempSync(path.join(os.tmpdir(), "pikachubball-static-"));
  fs.mkdirSync(path.join(staticFixturePath, "assets"));
  fs.writeFileSync(
    path.join(staticFixturePath, "index.html"),
    '<div id="root"></div><script type="module" src="/assets/app-a1b2c3.js"></script><link rel="stylesheet" href="/assets/app-d4e5f6.css">',
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
    expect(response.body).toEqual({ status: "ok", service: "pikachubball" });
  });

  it("keeps unknown API routes JSON", async () => {
    const response = await request(createApiApp()).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({
      error: "API route not found",
      code: "NOT_FOUND",
    });
  });

  it("passes route failures through the application error handler", async () => {
    const response = await request(createApiApp()).get(
      "/api/auth/callback",
    );

    expect(response.status).toBe(400);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({
      error: "Missing authorization code",
      code: "VALIDATION_ERROR",
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
    const indexHtml = fs.readFileSync(
      path.join(staticFixturePath, "index.html"),
      "utf8",
    );
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
      Array.from({ length: 14 }, () => request(app).get("/api/health")),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
  });
});
