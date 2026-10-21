import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allPassed, compareAfterDeploy } from "../../../../scripts/config-check/compare.mts";
import { contractSchema, type Snapshot } from "../../../../scripts/config-check/contracts.mts";
import { readProviders } from "../../../../scripts/release/config.mts";
import type { ReadOnlyQuery } from "../../../../scripts/release/drift.mts";

const contract = contractSchema.parse(
  JSON.parse(readFileSync("config/hosted-contract.json", "utf8"))
);
const now = new Date("2026-10-21T03:00:00Z");
const yahoo = {
  identifier: "custom:yahoo",
  providerType: "oidc",
  issuer: "https://api.login.yahoo.com",
  enabled: true,
  pkceEnabled: true,
  skipNonceCheck: false,
  scopes: ["openid", "profile", "email", "fspt-r"],
};

function snapshot(): Snapshot {
  return {
    environment: "prod",
    capturedAt: "2026-10-21T02:59:30Z",
    projectRef: contract.environments.prod.projectRef,
    providers: [{ ...yahoo, scopes: [...yahoo.scopes] }],
    auth: null,
    database: null,
    vercel: {
      projectId: contract.vercelProjectId,
      teamId: contract.vercelTeamId,
      variables: contract.requiredVariables.map((key) => ({
        key,
        target: ["production"],
        gitBranch: null,
      })),
    },
  };
}

describe("configuration checks after a deploy", () => {
  it("passes on a matching provider and Vercel variables without Auth or schema metadata", () => {
    const results = compareAfterDeploy(snapshot(), contract, now);
    expect(results.map((r) => r.check)).toEqual([
      "project identity",
      "fresh metadata",
      "Yahoo provider and scopes",
      "Vercel variables and isolation",
    ]);
    expect(allPassed(results)).toBe(true);
  });

  it.each([
    [
      "Yahoo provider and scopes",
      (s: Snapshot) => {
        s.providers?.[0]?.scopes.push("fspt-w");
      },
    ],
    [
      "Vercel variables and isolation",
      (s: Snapshot) => {
        s.vercel?.variables.push({ key: "ENCRYPTION_KEY", target: ["preview"], gitBranch: null });
      },
    ],
  ])("fails a seeded mismatch in %s", (check, mutate) => {
    const s = snapshot();
    mutate(s);
    const results = compareAfterDeploy(s, contract, now);
    expect(allPassed(results)).toBe(false);
    expect(results).toContainEqual({ check, outcome: "mismatch" });
  });

  it("reports nothing as passed from another project's metadata", () => {
    const s = snapshot();
    s.projectRef = "abcdefghijklmnopqrst";
    const results = compareAfterDeploy(s, contract, now);
    expect(results.filter((r) => r.outcome === "passed").map((r) => r.check)).toEqual([
      "fresh metadata",
    ]);
    expect(results).toContainEqual({ check: "Yahoo provider and scopes", outcome: "unavailable" });
  });
});

describe("reading production's sign-in providers", () => {
  function recording(rows: string[]): { query: ReadOnlyQuery; sent: string[] } {
    const sent: string[] = [];
    return {
      sent,
      query: async (sql) => {
        sent.push(sql);
        return rows;
      },
    };
  }

  it("wraps the committed projection in one JSON row and parses it", async () => {
    const { query, sent } = recording([JSON.stringify([yahoo])]);
    const projection = readFileSync("scripts/config-check/providers.sql", "utf8");
    expect(await readProviders(query, projection)).toEqual([yahoo]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("from auth.custom_oauth_providers order by identifier\n) p");
  });

  it("reads no providers as an empty list, which the comparison fails", async () => {
    const providers = await readProviders(recording(["[]"]).query, "select 1");
    expect(providers).toEqual([]);
    const s = snapshot();
    s.providers = providers;
    expect(compareAfterDeploy(s, contract, now)).toContainEqual({
      check: "Yahoo provider and scopes",
      outcome: "mismatch",
    });
  });

  it.each([
    ["no row", []],
    ["a field outside the projection", [JSON.stringify([{ ...yahoo, client_secret: "x" }])]],
  ])("refuses %s", async (_label, rows) => {
    await expect(readProviders(recording(rows).query, "select 1")).rejects.toThrow();
  });
});
