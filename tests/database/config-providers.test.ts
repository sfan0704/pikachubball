import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readProviders } from "../../scripts/release/config.mts";
import type { ReadOnlyQuery } from "../../scripts/release/drift.mts";
import { database } from "./local-stack";

const projection = readFileSync("scripts/config-check/providers.sql", "utf8");
const query: ReadOnlyQuery = async (sql) => {
  const { rows } = await database.query<unknown[]>({ text: sql, rowMode: "array" });
  return rows.map((row) => String(row[0]));
};

beforeAll(() => database.connect());
afterAll(() => database.end());

describe("the Deploy workflow's provider read against a migration-built stack", () => {
  it("runs the committed projection and parses each provider", async () => {
    const before = await readProviders(query, projection);
    await database.query("begin");
    try {
      await database.query(
        `insert into auth.custom_oauth_providers
           (provider_type, identifier, name, client_id, client_secret, issuer, scopes, pkce_enabled, enabled, skip_nonce_check)
         values ('oidc', 'custom:yahoo', 'Yahoo', 'id', 'secret', 'https://api.login.yahoo.com',
           array['openid', 'profile', 'email', 'fspt-r'], true, true, false)`
      );
      expect(await readProviders(query, projection)).toEqual([
        ...before,
        {
          identifier: "custom:yahoo",
          providerType: "oidc",
          issuer: "https://api.login.yahoo.com",
          enabled: true,
          pkceEnabled: true,
          skipNonceCheck: false,
          scopes: ["openid", "profile", "email", "fspt-r"],
        },
      ]);
    } finally {
      await database.query("rollback");
    }
  });
});
