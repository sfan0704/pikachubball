import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  createRateLimiters,
  DATA_REQUESTS_PER_MINUTE,
  LEAGUE_REFRESHES_PER_MINUTE,
} from "../../../../server/http/middleware/rate-limiter";
import { createErrorHandler } from "../../../../server/http/middleware/error-handler";
import { createRequestScope } from "../../../../server/http/middleware/request-scope";
import { buildRequestContext } from "../../../support/context";
import { buildTestDependencies, silentLogger } from "../../../support/dependencies";

function appWith(skip: boolean) {
  const app = express();
  app.use(createRequestScope(buildTestDependencies()));
  const { auth } = createRateLimiters({ skip });
  app.get("/login", auth, (_req, res) => res.status(401).json({ ok: false }));
  app.use(createErrorHandler({ logger: silentLogger, exposeErrorDetails: false }));
  return app;
}

describe("createRateLimiters", () => {
  it("answers the sixth failed sign-in attempt with RATE_LIMITED and Retry-After", async () => {
    const app = appWith(false);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).get("/login").expect(401);
    }

    const limited = await request(app).get("/login");

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      code: "RATE_LIMITED",
      message: "Too many login attempts, please try again later",
      requestId: expect.any(String),
      details: { retryAfterSeconds: expect.any(Number) },
    });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("applies no limit when skipped", async () => {
    const app = appWith(true);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await request(app).get("/login").expect(401);
    }
  });
});

describe("per-user limiters", () => {
  /** An app where the `x-user` header stands in for the signed-in user. */
  function userApp(limits: { data?: number; leagueRefresh?: number }) {
    const app = express();
    app.use(createRequestScope(buildTestDependencies()));
    app.use((req, _res, next) => {
      const userId = req.get("x-user");
      if (userId) {
        req.context = buildRequestContext({ user: { ...baseUser, userId } });
      }
      next();
    });
    const limiters = createRateLimiters({ skip: false, limits });
    app.get("/data", limiters.data, (_req, res) => res.json({ ok: true }));
    app.get("/refresh", limiters.leagueRefresh, (_req, res) => res.json({ ok: true }));
    app.use(createErrorHandler({ logger: silentLogger, exposeErrorDetails: false }));
    return app;
  }

  const baseUser = { userId: "", yahooGuid: "g", displayName: null, email: null };

  it("limits data requests per user and answers the next one with RATE_LIMITED and Retry-After", async () => {
    const app = userApp({ data: 3 });
    for (let i = 0; i < 3; i += 1) {
      await request(app).get("/data").set("x-user", "alice").expect(200);
    }

    const limited = await request(app).get("/data").set("x-user", "alice");

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ code: "RATE_LIMITED", requestId: expect.any(String) });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts each user separately, even from the same address", async () => {
    const app = userApp({ data: 2 });
    for (let i = 0; i < 2; i += 1) {
      await request(app).get("/data").set("x-user", "alice").expect(200);
    }
    await request(app).get("/data").set("x-user", "alice").expect(429);

    await request(app).get("/data").set("x-user", "bob").expect(200);
    await request(app).get("/data").set("x-user", "bob").expect(200);
    await request(app).get("/data").set("x-user", "bob").expect(429);
  });

  it("limits league-list refreshes to one a minute by default", async () => {
    const app = userApp({});

    await request(app).get("/refresh").set("x-user", "alice").expect(200);
    const second = await request(app).get("/refresh").set("x-user", "alice");

    expect(second.status).toBe(429);
    expect(second.body.message).toMatch(/refreshed/);
    await request(app).get("/refresh").set("x-user", "bob").expect(200);
  });

  it("keeps the two limits independent", async () => {
    const app = userApp({ data: 1 });
    await request(app).get("/data").set("x-user", "alice").expect(200);
    await request(app).get("/data").set("x-user", "alice").expect(429);

    await request(app).get("/refresh").set("x-user", "alice").expect(200);
  });

  it("applies the documented defaults: 60 data requests and 1 refresh a minute", () => {
    expect(DATA_REQUESTS_PER_MINUTE).toBe(60);
    expect(LEAGUE_REFRESHES_PER_MINUTE).toBe(1);
  });

  it("applies no limit when skipped", async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.context = buildRequestContext();
      next();
    });
    const { data } = createRateLimiters({ skip: true, limits: { data: 1 } });
    app.get("/data", data, (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 5; i += 1) {
      await request(app).get("/data").expect(200);
    }
  });
});
