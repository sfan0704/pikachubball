import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { readHostedAuthConfig } from "../../../../server/auth/supabase-auth";

// .env.example is the committed dev-tier template (README "Local setup").
// It must name every variable the server reads and must never carry a real
// secret, because it is committed to the repository.

const examplePath = path.resolve(__dirname, "../../../../.env.example");

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return values;
}

const example = parseEnvFile(fs.readFileSync(examplePath, "utf-8"));

describe(".env.example dev-tier template", () => {
  it("lists every variable the server needs for the dev tier", () => {
    expect(Object.keys(example).sort()).toEqual(
      [
        "APP_ORIGIN",
        "ENCRYPTION_KEY",
        "NODE_ENV",
        "PORT",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_URL",
        "YAHOO_CLIENT_ID",
        "YAHOO_CLIENT_SECRET",
        "YAHOO_PROVIDER_REDIRECT_URI",
      ].sort(),
    );
  });

  it("targets the dev tier on the documented local port", () => {
    expect(example.NODE_ENV).toBe("development");
    expect(example.PORT).toBe("5001");
    expect(example.APP_ORIGIN).toBe("http://localhost:5001");
    expect(example.SUPABASE_URL).toBe("https://ocqdxmfpezxpgutoicyh.supabase.co");
    expect(example.YAHOO_PROVIDER_REDIRECT_URI).toBe(
      `${example.SUPABASE_URL}/auth/v1/callback`,
    );
  });

  it("never points at the production Supabase project", () => {
    expect(Object.values(example).join("\n")).not.toContain("fpdwtpwpmxsbgjxizuxa");
  });

  it("contains placeholders instead of secrets", () => {
    expect(example.ENCRYPTION_KEY).not.toMatch(/^[a-fA-F0-9]{64}$/);
    expect(example.SUPABASE_PUBLISHABLE_KEY).toMatch(/replace-me$/);
    expect(example.YAHOO_CLIENT_ID).toBe("replace-me");
    expect(example.YAHOO_CLIENT_SECRET).toBe("replace-me");
  });

  it("is accepted by the hosted auth configuration once filled in", () => {
    const config = readHostedAuthConfig({
      ...example,
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic-test-key",
    });

    expect(config.appOrigin).toBe("http://localhost:5001");
    expect(config.supabaseUrl).toBe("https://ocqdxmfpezxpgutoicyh.supabase.co");
    expect(config.secureCookies).toBe(false);
  });
});
