import { describe, expect, it } from "vitest";
import {
  expired,
  hostedConfiguration,
  lifetimeMinutes,
  newRecord,
  parseRecord,
} from "../../../../scripts/review/lifecycle.mts";

describe("hostedConfiguration", () => {
  it("accepts a clean environment and loopback targets", () => {
    expect(hostedConfiguration({ PATH: "/bin" })).toEqual([]);
    expect(
      hostedConfiguration({
        SUPABASE_URL: "http://127.0.0.1:41741",
        SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:41742/postgres",
        APP_ORIGIN: "http://localhost:20873",
      })
    ).toEqual([]);
  });

  it("refuses hosted targets and real credentials, naming them without their values", () => {
    const problems = hostedConfiguration({
      SUPABASE_URL: "https://fpdwtpwpmxsbgjxizuxa.supabase.co",
      YAHOO_API_BASE_URL: "https://fantasysports.yahooapis.com/fantasy/v2",
      YAHOO_CLIENT_SECRET: "real-secret-value",
      ENCRYPTION_KEY: "real-key-value",
      NODE_ENV: "production",
    });

    expect(problems).toEqual([
      "SUPABASE_URL points at a hosted address",
      "YAHOO_API_BASE_URL points at a hosted address",
      "YAHOO_CLIENT_SECRET is set",
      "ENCRYPTION_KEY is set",
      "NODE_ENV is production",
    ]);
    expect(problems.join(" ")).not.toMatch(/real-secret-value|real-key-value|fpdwtpwp/);
  });

  it("isn't fooled by a loopback name inside a hosted address", () => {
    expect(hostedConfiguration({ SUPABASE_URL: "https://localhost.evil.example" })).toHaveLength(1);
  });
});

describe("the review record", () => {
  const record = newRecord({
    url: "http://localhost:20873",
    commit: "abc1234",
    workspace: "pikachubball-96bbc1c0",
    pid: 4242,
    now: Date.parse("2026-10-12T10:00:00Z"),
    lifetimeMinutes: 120,
  });

  it("expires after its lifetime and not before", () => {
    expect(record.expiresAt).toBe("2026-10-12T12:00:00.000Z");
    expect(expired(record, Date.parse("2026-10-12T11:59:59Z"))).toBe(false);
    expect(expired(record, Date.parse("2026-10-12T12:00:00Z"))).toBe(true);
  });

  it("reads back what it wrote, and refuses anything else", () => {
    expect(parseRecord(JSON.stringify(record))).toEqual(record);
    expect(() => parseRecord(JSON.stringify({ url: "x" }))).toThrow(/not one this tool wrote/);
    expect(() => parseRecord(JSON.stringify({ ...record, pid: "4242" }))).toThrow(
      /not one this tool wrote/
    );
  });
});

describe("lifetimeMinutes", () => {
  it("defaults to two hours and accepts up to twelve", () => {
    expect(lifetimeMinutes({})).toBe(120);
    expect(lifetimeMinutes({ REVIEW_LIFETIME_MINUTES: "720" })).toBe(720);
  });

  it("refuses a lifetime that isn't a sensible whole number of minutes", () => {
    for (const value of ["0", "721", "1.5", "forever"]) {
      expect(() => lifetimeMinutes({ REVIEW_LIFETIME_MINUTES: value })).toThrow(/whole number/);
    }
  });
});
