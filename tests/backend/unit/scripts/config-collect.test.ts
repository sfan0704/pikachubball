import { describe, expect, it, vi } from "vitest";
import { collectDatabase } from "../../../../scripts/config-check/collect.mts";

describe("configuration metadata collection", () => {
  it("uses only read-only database queries and projects no provider secret values", async () => {
    const transport = vi.fn<typeof fetch>();
    transport.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            identifier: "custom:yahoo",
            providerType: "oidc",
            issuer: "https://api.login.yahoo.com",
            enabled: true,
            pkceEnabled: true,
            skipNonceCheck: false,
            scopes: ["openid", "profile", "email", "fspt-r"],
          },
        ])
      )
    );
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify([{ schema_digest: "a".repeat(64) }]))
    );
    transport.mockResolvedValueOnce(new Response(JSON.stringify([{ version: "202609120001" }])));
    const result = await collectDatabase(
      "ocqdxmfpezxpgutoicyh",
      "synthetic-token",
      "select fingerprint",
      "select metadata",
      transport
    );
    expect(result.database?.migrationVersions).toEqual(["202609120001"]);
    for (const [url, init] of transport.mock.calls) {
      expect(url).toBe("https://api.supabase.com/v1/projects/ocqdxmfpezxpgutoicyh/database/query");
      expect(init?.redirect).toBe("error");
      expect(JSON.parse(String(init?.body)).read_only).toBe(true);
    }
  });

  it("does not echo a failed platform response containing accidental secrets", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("never-print-credential", { status: 403 }));
    await expect(
      collectDatabase(
        "ocqdxmfpezxpgutoicyh",
        "synthetic-token",
        "select metadata",
        "select metadata",
        transport
      )
    ).rejects.toThrow("Metadata access unavailable");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects unexpected provider fields and stops before reading further sources", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([{ client_secret: "synthetic" }])));
    await expect(
      collectDatabase(
        "ocqdxmfpezxpgutoicyh",
        "synthetic-token",
        "select metadata",
        "select metadata",
        transport
      )
    ).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
