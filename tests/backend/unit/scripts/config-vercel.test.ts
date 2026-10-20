import { describe, expect, it, vi } from "vitest";
import { collectVercel } from "../../../../scripts/config-check/vercel.mts";

const contract = { vercelProjectId: "prj_basketball", vercelTeamId: "team_basketball" };
const SECRET = "synthetic-value-never-retained";

function transportFor(envs: unknown) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        id: contract.vercelProjectId,
        accountId: contract.vercelTeamId,
        secret: SECRET,
      })
    )
    .mockResolvedValueOnce(Response.json({ envs }));
}

describe("Vercel configuration metadata acquisition", () => {
  it("keeps every variable scope and branch while discarding all value fields", async () => {
    const variables = [
      { key: "APP_ORIGIN", target: ["production"], value: SECRET, id: "env_prod" },
      { key: "APP_ORIGIN", target: ["preview"], gitBranch: "main", value: SECRET },
      { key: "ENCRYPTION_KEY", target: ["development"], gitBranch: null, value: SECRET },
    ];
    const transport = transportFor(variables);
    const observed = await collectVercel(contract, "synthetic-token", transport);
    expect(observed).toEqual({
      projectId: contract.vercelProjectId,
      teamId: contract.vercelTeamId,
      variables: variables.map(({ key, target, gitBranch }) => ({
        key,
        target,
        gitBranch: gitBranch ?? null,
      })),
    });
    expect(JSON.stringify(observed)).not.toContain(SECRET);
    const urls = transport.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.map((url) => url.pathname)).toEqual([
      "/v9/projects/prj_basketball",
      "/v10/projects/prj_basketball/env",
    ]);
    expect(urls[1]?.searchParams.get("decrypt")).toBe("false");
    for (const [url, init] of transport.mock.calls) {
      expect(new URL(String(url)).searchParams.get("teamId")).toBe(contract.vercelTeamId);
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("error");
      expect(init?.body).toBeUndefined();
    }
  });

  it.each([
    { id: "prj_other", accountId: contract.vercelTeamId },
    { id: contract.vercelProjectId, accountId: "team_other" },
  ])("rejects another project or team before reading variables", async (project) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(project));
    await expect(collectVercel(contract, "synthetic-token", transport)).rejects.toThrow(
      "Vercel metadata access unavailable"
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 429, 500])(
    "fails closed on HTTP %s without echoing its body",
    async (status) => {
      const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(SECRET, { status }));
      await expect(collectVercel(contract, "synthetic-token", transport)).rejects.toThrow(
        /^Vercel metadata access unavailable$/
      );
      expect(transport).toHaveBeenCalledTimes(1);
    }
  );

  it.each([{}, [{ key: SECRET, target: [SECRET] }], [{ key: "KEY" }]])(
    "rejects incomplete or invalid scope metadata without validation details",
    async (envs) => {
      await expect(collectVercel(contract, "synthetic-token", transportFor(envs))).rejects.toThrow(
        /^Vercel metadata access unavailable$/
      );
    }
  );

  it("sanitizes transport errors and does not follow platform redirects", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error(SECRET));
    await expect(collectVercel(contract, "synthetic-token", transport)).rejects.toThrow(
      /^Vercel metadata access unavailable$/
    );
  });

  it("refuses a missing token or malformed identity before making a request", async () => {
    const transport = vi.fn<typeof fetch>();
    await expect(collectVercel(contract, "", transport)).rejects.toThrow();
    await expect(
      collectVercel({ ...contract, vercelProjectId: "../other" }, "token", transport)
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});
