import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createRateLimiters } from "../../../../server/middleware/rate-limiter";
import { createErrorHandler } from "../../../../server/middleware/error-handler";
import { requestId } from "../../../../server/middleware/request-id";
import type { Logger } from "../../../../server/utils/logger";

const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

function appWith(skip: boolean) {
  const app = express();
  app.use(requestId);
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
