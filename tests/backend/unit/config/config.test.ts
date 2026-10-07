import { describe, expect, it } from "vitest";
import { loadConfig } from "../../../../server/config/config";

const VALID_KEY = "0123456789abcdef".repeat(4);
const OTHER_KEY = "fedcba9876543210".repeat(4);

/** The smallest environment the server accepts. */
function minimalEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ENCRYPTION_KEY: VALID_KEY,
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    ...overrides,
  };
}

describe("loadConfig", () => {
  it("starts without a database password or legacy session secret", () => {
    const config = loadConfig(minimalEnvironment({ PORT: "5000" }));

    expect(config.port).toBe(5000);
    expect(config).not.toHaveProperty("DATABASE_URL");
    expect(config).not.toHaveProperty("SESSION_SECRET");
  });

  it("uses the retained local defaults", () => {
    const config = loadConfig({
      ENCRYPTION_KEY: VALID_KEY,
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });

    expect(config.nodeEnv).toBe("development");
    expect(config.port).toBe(5000);
    expect(config.trustProxy).toBe(false);
    expect(config.auth.appOrigin).toBe("http://localhost:5000");
    expect(config.auth.supabaseUrl).toBe("http://127.0.0.1:54321");
    expect(config.auth.secureCookies).toBe(false);
  });

  it("accepts only a 32-byte hexadecimal token key", () => {
    expect(() => loadConfig(minimalEnvironment({ ENCRYPTION_KEY: "z".repeat(64) }))).toThrow(
      /ENCRYPTION_KEY/
    );
  });

  it("accepts a previous key only in the same format, and leaves it unset by default", () => {
    expect(loadConfig(minimalEnvironment()).encryptionKeyPrevious).toBeNull();
    expect(
      loadConfig(minimalEnvironment({ ENCRYPTION_KEY_PREVIOUS: OTHER_KEY })).encryptionKeyPrevious
    ).toBe(OTHER_KEY);
    expect(() => loadConfig(minimalEnvironment({ ENCRYPTION_KEY_PREVIOUS: "short" }))).toThrow(
      /ENCRYPTION_KEY_PREVIOUS/
    );
  });

  it("requires the Supabase publishable key", () => {
    expect(() => loadConfig({ NODE_ENV: "test", ENCRYPTION_KEY: VALID_KEY })).toThrow(
      /SUPABASE_PUBLISHABLE_KEY/
    );
  });

  it("names every problem in one error", () => {
    expect(() => loadConfig({ NODE_ENV: "test" })).toThrow(
      /ENCRYPTION_KEY.*SUPABASE_PUBLISHABLE_KEY|SUPABASE_PUBLISHABLE_KEY.*ENCRYPTION_KEY/
    );
  });

  it("keeps Yahoo refresh credentials together under the yahoo section", () => {
    const config = loadConfig(
      minimalEnvironment({
        YAHOO_CLIENT_ID: " client-id ",
        YAHOO_CLIENT_SECRET: "client-secret",
        YAHOO_PROVIDER_REDIRECT_URI: "https://project.supabase.co/auth/v1/callback",
      })
    );

    expect(config.yahoo).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      providerRedirectUri: "https://project.supabase.co/auth/v1/callback",
    });
  });

  it("leaves Yahoo credentials null when unset", () => {
    expect(loadConfig(minimalEnvironment()).yahoo).toEqual({
      clientId: null,
      clientSecret: null,
      providerRedirectUri: null,
    });
  });

  it("rejects an invalid Yahoo provider redirect", () => {
    expect(() =>
      loadConfig(minimalEnvironment({ YAHOO_PROVIDER_REDIRECT_URI: "not-a-url" }))
    ).toThrow(/YAHOO_PROVIDER_REDIRECT_URI/);
  });

  describe("origins", () => {
    it("accepts exact HTTPS origins and rejects path-bearing ones", () => {
      const config = loadConfig(
        minimalEnvironment({
          APP_ORIGIN: "https://basketball.example.test",
          SUPABASE_URL: "https://basketball-project.supabase.co",
        })
      );
      expect(config.auth).toMatchObject({
        appOrigin: "https://basketball.example.test",
        supabaseUrl: "https://basketball-project.supabase.co",
      });

      expect(() =>
        loadConfig(minimalEnvironment({ APP_ORIGIN: "https://basketball.example.test/unexpected" }))
      ).toThrow(/origin without/);
    });

    it("allows loopback http outside production and refuses it in production", () => {
      expect(() =>
        loadConfig(minimalEnvironment({ APP_ORIGIN: "http://localhost:5001" }))
      ).not.toThrow();
      expect(() =>
        loadConfig(
          minimalEnvironment({
            NODE_ENV: "production",
            APP_ORIGIN: "http://localhost:5001",
            SUPABASE_URL: "https://p.supabase.co",
          })
        )
      ).toThrow(/must use HTTPS/);
    });
  });

  describe("production", () => {
    const production = (overrides: NodeJS.ProcessEnv = {}) =>
      minimalEnvironment({
        NODE_ENV: "production",
        APP_ORIGIN: "https://basketball.example.test",
        SUPABASE_URL: "https://p.supabase.co",
        ...overrides,
      });

    it("turns on secure cookies and the proxy setting", () => {
      const config = loadConfig(production());
      expect(config.auth.secureCookies).toBe(true);
      expect(config.trustProxy).toBe(true);
    });

    it("rejects a publishable key in an unsupported format", () => {
      expect(() =>
        loadConfig(production({ SUPABASE_PUBLISHABLE_KEY: "sb_secret_leaked" }))
      ).toThrow(/unsupported format/);
    });
  });

  it("trusts the proxy outside production only when asked", () => {
    expect(loadConfig(minimalEnvironment({ TRUST_PROXY: "true" })).trustProxy).toBe(true);
    expect(loadConfig(minimalEnvironment({ TRUST_PROXY: "false" })).trustProxy).toBe(false);
  });

  it("takes the build id from the deployed commit, or says it is a development build", () => {
    expect(loadConfig(minimalEnvironment()).buildId).toBe("development");
    expect(loadConfig(minimalEnvironment({ VERCEL_GIT_COMMIT_SHA: "abc1234" })).buildId).toBe(
      "abc1234"
    );
    expect(loadConfig(minimalEnvironment({ VERCEL_GIT_COMMIT_SHA: "  " })).buildId).toBe(
      "development"
    );
  });
});
