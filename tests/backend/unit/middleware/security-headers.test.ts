import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
  createSecurityHeaders,
} from "../../../../server/http/middleware/security-headers";

function run(development: boolean) {
  const headers = new Map<string, string>();
  const res = { setHeader: (name: string, value: string) => headers.set(name, value) };
  const next = vi.fn();
  createSecurityHeaders({ development })({} as Request, res as unknown as Response, next);
  expect(next).toHaveBeenCalledWith();
  return headers;
}

describe("security headers", () => {
  it("sets every header in production", () => {
    const headers = run(false);
    expect(Object.fromEntries(headers)).toEqual(SECURITY_HEADERS);
  });

  it("leaves out the CSP and HSTS in development only", () => {
    const headers = run(true);
    expect(headers.has("Content-Security-Policy")).toBe(false);
    expect(headers.has("Strict-Transport-Security")).toBe(false);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("allows no third-party host, inline script or eval", () => {
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:|\*/);
    const scriptSrc = CONTENT_SECURITY_POLICY.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });

  it("matches the headers vercel.json gives static files", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const entry = config.headers.find((h) => h.source === "/(.*)");
    const fromVercel = Object.fromEntries((entry?.headers ?? []).map((h) => [h.key, h.value]));
    expect(fromVercel).toEqual(SECURITY_HEADERS);
  });
});
