import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_KEY = "0123456789abcdef".repeat(4);

describe("hosted environment configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("starts without a database password or legacy session secret", async () => {
    process.env = {
      NODE_ENV: "test",
      ENCRYPTION_KEY: VALID_KEY,
      PORT: "5000",
    };

    const { env } = await import("../../../../server/config/env");

    expect(env.PORT).toBe(5000);
    expect(env).not.toHaveProperty("DATABASE_URL");
    expect(env).not.toHaveProperty("SESSION_SECRET");
  });

  it("accepts only a 32-byte hexadecimal token key", async () => {
    process.env = { NODE_ENV: "test", ENCRYPTION_KEY: "z".repeat(64) };

    await expect(import("../../../../server/config/env")).rejects.toThrow(
      /ENCRYPTION_KEY/,
    );
  });

  it("keeps Yahoo refresh credentials server-side", async () => {
    process.env = {
      NODE_ENV: "test",
      ENCRYPTION_KEY: VALID_KEY,
      YAHOO_CLIENT_ID: "client-id",
      YAHOO_CLIENT_SECRET: "client-secret",
      YAHOO_PROVIDER_REDIRECT_URI:
        "https://project.supabase.co/auth/v1/callback",
    };

    const { env } = await import("../../../../server/config/env");

    expect(env.YAHOO_CLIENT_ID).toBe("client-id");
    expect(env.YAHOO_CLIENT_SECRET).toBe("client-secret");
    expect(env.YAHOO_PROVIDER_REDIRECT_URI).toContain("supabase.co");
  });

  it("rejects an invalid Yahoo provider redirect", async () => {
    process.env = {
      NODE_ENV: "test",
      ENCRYPTION_KEY: VALID_KEY,
      YAHOO_PROVIDER_REDIRECT_URI: "not-a-url",
    };

    await expect(import("../../../../server/config/env")).rejects.toThrow(
      /YAHOO_PROVIDER_REDIRECT_URI/,
    );
  });

  it("uses the retained local defaults", async () => {
    process.env = { ENCRYPTION_KEY: VALID_KEY };

    const { env } = await import("../../../../server/config/env");

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(5000);
    expect(env.TRUST_PROXY).toBe(false);
  });
});
