import type { Baseline, Contract, Result, Snapshot } from "./contracts.mts";

/** Inputs tied to the repository and a fixed clock, rather than hidden session state. */
export interface Context {
  readonly now: Date;
  readonly migrationsDigest: string;
  readonly queryDigest: string;
  readonly migrationVersions: readonly string[];
}

function equalSet(a: readonly string[], b: readonly string[]): boolean {
  return (
    a.length === new Set(a).size &&
    b.length === new Set(b).size &&
    JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
  );
}

function result(check: string, matches: boolean | null): Result {
  return { check, outcome: matches === null ? "unavailable" : matches ? "passed" : "mismatch" };
}

function providerMatches(providers: Snapshot["providers"]): boolean | null {
  if (providers === null) return null;
  const yahoo = providers.filter((p) => p.identifier === "custom:yahoo");
  const p = yahoo[0];
  return (
    yahoo.length === 1 &&
    providers.filter((item) => item.enabled).length === 1 &&
    p !== undefined &&
    p.providerType === "oidc" &&
    p.issuer === "https://api.login.yahoo.com" &&
    p.enabled &&
    p.pkceEnabled &&
    !p.skipNonceCheck &&
    equalSet(p.scopes, ["openid", "profile", "email", "fspt-r"])
  );
}

function variablesMatch(snapshot: Snapshot, contract: Contract): boolean | null {
  const v = snapshot.vercel;
  if (v === null) return null;
  if (v.projectId !== contract.vercelProjectId || v.teamId !== contract.vercelTeamId) return false;
  const required = new Set(contract.requiredVariables);
  const forbidden = new Set(contract.forbiddenVariables);
  // Server variables live in production alone; every preview, main's included, is build-only.
  const leaks = v.variables.some(
    (item) =>
      forbidden.has(item.key) ||
      (item.key.startsWith("VITE_") &&
        (required.has(item.key.slice(5)) || forbidden.has(item.key.slice(5)))) ||
      (required.has(item.key) &&
        (item.target.length !== 1 || item.target[0] !== "production" || item.gitBranch !== null))
  );
  if (leaks) return false;
  return contract.requiredVariables.every(
    (key) => v.variables.filter((item) => item.key === key).length === 1
  );
}

function inputResults(snapshot: Snapshot, contract: Contract, now: Date): Result[] {
  const expected = contract.environments[snapshot.environment];
  const age = now.getTime() - Date.parse(snapshot.capturedAt);
  return [
    result("project identity", snapshot.projectRef === expected.projectRef),
    result("fresh metadata", age >= -300_000 && age <= 86_400_000),
  ];
}

/** Compare each promised criterion; reports never echo observed metadata or values. */
export function compare(
  snapshot: Snapshot,
  baseline: Baseline | null,
  contract: Contract,
  context: Context
): Result[] {
  const expected = contract.environments[snapshot.environment];
  const inputs = inputResults(snapshot, contract, context.now);
  if (!allPassed(inputs))
    return [
      ...inputs,
      ...[
        "Yahoo provider and scopes",
        "redirect allowlist",
        "schema and migrations",
        "Vercel variables and isolation",
      ].map((check) => result(check, null)),
    ];
  const auth = snapshot.auth;
  const db = snapshot.database;
  const schema =
    db === null || baseline === null
      ? null
      : baseline.migrationsDigest === context.migrationsDigest &&
        baseline.queryDigest === context.queryDigest &&
        db.schemaDigest === baseline.schemaDigest &&
        equalSet(db.migrationVersions, context.migrationVersions);
  return [
    ...inputs,
    result("Yahoo provider and scopes", providerMatches(snapshot.providers)),
    result(
      "redirect allowlist",
      auth === null
        ? null
        : auth.siteUrl === expected.siteUrl &&
            equalSet(auth.redirectAllowList, expected.redirectAllowList)
    ),
    result("schema and migrations", schema),
    result("Vercel variables and isolation", variablesMatch(snapshot, contract)),
  ];
}

/**
 * The checks the Deploy workflow runs after each deploy. Its drift check
 * already covers the schema, and Auth's URLs are read by hand: the only API
 * for them needs an account-wide Supabase token.
 */
export function compareAfterDeploy(snapshot: Snapshot, contract: Contract, now: Date): Result[] {
  const inputs = inputResults(snapshot, contract, now);
  const trusted = allPassed(inputs);
  return [
    ...inputs,
    result("Yahoo provider and scopes", trusted ? providerMatches(snapshot.providers) : null),
    result("Vercel variables and isolation", trusted ? variablesMatch(snapshot, contract) : null),
  ];
}

/** Only a complete matching observation is a successful check. */
export function allPassed(results: readonly Result[]): boolean {
  return results.length > 0 && results.every((r) => r.outcome === "passed");
}
