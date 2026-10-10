import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createOriginCheck } from "../../../../server/http/middleware/origin-check";
import { ForbiddenError } from "../../../../shared/api/errors";

const APP_ORIGIN = "https://basketball.example.test";
const check = createOriginCheck(APP_ORIGIN);

function run(method: string, origin?: string) {
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  const req = {
    method,
    get: (name: string) => (name.toLowerCase() === "origin" ? origin : undefined),
  } as unknown as Request;
  check(req, {} as Response, next);
  return next;
}

describe("origin check", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("lets %s through whatever its origin", (method) => {
    expect(run(method)).toHaveBeenCalledWith();
    expect(run(method, "https://evil.example.test")).toHaveBeenCalledWith();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("lets %s from the app's origin through", (method) => {
    expect(run(method, APP_ORIGIN)).toHaveBeenCalledWith();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("refuses %s from another origin", (method) => {
    const next = run(method, "https://evil.example.test");
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("refuses a state-changing request with no origin", () => {
    expect(run("POST")).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("compares the whole origin, not a prefix or a lookalike", () => {
    for (const origin of [
      `${APP_ORIGIN}.evil.example.test`,
      "http://basketball.example.test",
      `${APP_ORIGIN}:8443`,
      `${APP_ORIGIN}/`,
      "null",
    ]) {
      expect(run("POST", origin)).toHaveBeenCalledWith(expect.any(ForbiddenError));
    }
  });
});
