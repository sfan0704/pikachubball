import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";
import { allPassed, compare, type Context } from "../../../../scripts/config-check/compare.mts";
import {
  contractSchema,
  snapshotSchema,
  type Baseline,
  type Snapshot,
} from "../../../../scripts/config-check/contracts.mts";
import { digest, repositoryInputs } from "../../../../scripts/config-check/repository.mts";

const contract = contractSchema.parse(
  JSON.parse(readFileSync("config/hosted-contract.json", "utf8"))
);
const hash = "a".repeat(64);
const baseline: Baseline = {
  sourceCommit: "b".repeat(40),
  migrationsDigest: hash,
  queryDigest: hash,
  schemaDigest: hash,
};
const context: Context = {
  now: new Date("2026-10-14T14:00:00Z"),
  migrationsDigest: hash,
  queryDigest: hash,
  migrationVersions: ["202609120001"],
};

function snapshot(): Snapshot {
  return {
    environment: "prod",
    capturedAt: "2026-10-14T13:55:00Z",
    projectRef: contract.environments.prod.projectRef,
    providers: [
      {
        identifier: "custom:yahoo",
        providerType: "oidc",
        issuer: "https://api.login.yahoo.com",
        enabled: true,
        pkceEnabled: true,
        skipNonceCheck: false,
        scopes: ["openid", "profile", "email", "fspt-r"],
      },
    ],
    auth: {
      siteUrl: contract.environments.prod.siteUrl,
      redirectAllowList: [...contract.environments.prod.redirectAllowList],
    },
    database: { migrationVersions: ["202609120001"], schemaDigest: hash },
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

describe("configuration comparison", () => {
  it("passes a complete matching capture; scope ordering does not matter", () => {
    const s = snapshot();
    s.providers?.[0]?.scopes.reverse();
    expect(allPassed(compare(s, baseline, contract, context))).toBe(true);
  });

  it.each([
    [
      "provider disabled",
      (s: Snapshot) => {
        if (s.providers?.[0]) s.providers[0].enabled = false;
      },
    ],
    [
      "Fantasy write scope",
      (s: Snapshot) => {
        s.providers?.[0]?.scopes.push("fspt-w");
      },
    ],
    [
      "PKCE disabled",
      (s: Snapshot) => {
        if (s.providers?.[0]) s.providers[0].pkceEnabled = false;
      },
    ],
    [
      "nonce disabled",
      (s: Snapshot) => {
        if (s.providers?.[0]) s.providers[0].skipNonceCheck = true;
      },
    ],
    [
      "duplicate provider",
      (s: Snapshot) => {
        if (s.providers?.[0]) s.providers.push(s.providers[0]);
      },
    ],
    [
      "wildcard redirect",
      (s: Snapshot) => {
        s.auth?.redirectAllowList.push("https://*.vercel.app/**");
      },
    ],
    [
      "wrong site",
      (s: Snapshot) => {
        if (s.auth) s.auth.siteUrl = "https://other.example.test";
      },
    ],
    [
      "schema drift",
      (s: Snapshot) => {
        if (s.database) s.database.schemaDigest = "c".repeat(64);
      },
    ],
    [
      "missing migration",
      (s: Snapshot) => {
        if (s.database) s.database.migrationVersions = [];
      },
    ],
    [
      "missing variable",
      (s: Snapshot) => {
        s.vercel?.variables.pop();
      },
    ],
    [
      "wrong scope",
      (s: Snapshot) => {
        if (s.vercel?.variables[0]) s.vercel.variables[0].target = ["development"];
      },
    ],
    [
      "generic preview leak",
      (s: Snapshot) => {
        s.vercel?.variables.push({ key: "ENCRYPTION_KEY", target: ["preview"], gitBranch: null });
      },
    ],
    [
      "shared dev/prod row",
      (s: Snapshot) => {
        if (s.vercel?.variables[0]) s.vercel.variables[0].target.push("preview");
      },
    ],
    [
      "admin key",
      (s: Snapshot) => {
        s.vercel?.variables.push({
          key: "SUPABASE_SERVICE_ROLE_KEY",
          target: ["production"],
          gitBranch: null,
        });
      },
    ],
    [
      "browser secret",
      (s: Snapshot) => {
        s.vercel?.variables.push({
          key: "VITE_YAHOO_CLIENT_SECRET",
          target: ["production"],
          gitBranch: null,
        });
      },
    ],
    [
      "wrong team",
      (s: Snapshot) => {
        if (s.vercel) s.vercel.teamId = "another-team";
      },
    ],
  ])("fails a seeded %s mismatch", (_label, mutate) => {
    const s = snapshot();
    mutate(s);
    const results = compare(s, baseline, contract, context);
    expect(allPassed(results)).toBe(false);
    expect(results.some((r) => r.outcome === "mismatch")).toBe(true);
  });

  it("makes missing metadata unavailable, rather than passing the other checks", () => {
    const s = snapshot();
    s.auth = null;
    s.providers = null;
    s.database = null;
    s.vercel = null;
    const results = compare(s, null, contract, context);
    expect(results.filter((r) => r.outcome === "unavailable")).toHaveLength(4);
    expect(allPassed(results)).toBe(false);
  });

  it.each(["wrong project", "stale evidence", "future evidence"])(
    "refuses to certify %s",
    (name) => {
      const s = snapshot();
      if (name === "wrong project") s.projectRef = "atgnooivdbdrihxwfelf";
      else
        s.capturedAt = name === "stale evidence" ? "2026-10-12T14:00:00Z" : "2026-10-15T14:00:00Z";
      expect(
        compare(s, baseline, contract, context).filter((r) => r.outcome === "unavailable")
      ).toHaveLength(4);
    }
  );

  it("rejects a baseline from different migration bytes or a different catalog query", () => {
    for (const changed of [
      { ...baseline, migrationsDigest: "d".repeat(64) },
      { ...baseline, queryDigest: "d".repeat(64) },
    ]) {
      expect(compare(snapshot(), changed, contract, context)).toContainEqual({
        check: "schema and migrations",
        outcome: "mismatch",
      });
    }
  });

  it("requires main-specific variables for dev and keeps production variables separate", () => {
    const s = snapshot();
    s.environment = "dev";
    s.projectRef = contract.environments.dev.projectRef;
    s.auth = {
      siteUrl: contract.environments.dev.siteUrl,
      redirectAllowList: [...contract.environments.dev.redirectAllowList],
    };
    s.vercel?.variables.push(
      ...contract.requiredVariables.map((key) => ({
        key,
        target: ["preview" as const],
        gitBranch: "main",
      }))
    );
    expect(allPassed(compare(s, baseline, contract, context))).toBe(true);
  });

  it("binds repository expectations to migration and query bytes", () => {
    const input = repositoryInputs(resolve("."));
    expect(input.migrationVersions).toHaveLength(6);
    expect(input.queryDigest).toBe(digest(input.query));
    expect(input.query).not.toContain("client_secret");
  });

  it("rejects secret-bearing snapshots and never prints their content", () => {
    const s = { ...snapshot(), client_secret: "never-print-this-credential" };
    expect(snapshotSchema.safeParse(s).success).toBe(false);
    const folder = mkdtempSync(join(tmpdir(), "config-check-"));
    try {
      const file = join(folder, "metadata.json");
      writeFileSync(file, JSON.stringify(s));
      const run = spawnSync("node", ["scripts/config-check/cli.mts", file], { encoding: "utf8" });
      expect(run.status).toBe(1);
      expect(run.stdout + run.stderr).not.toContain(s.client_secret);
      expect(run.stderr).toContain("unavailable or invalid");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
