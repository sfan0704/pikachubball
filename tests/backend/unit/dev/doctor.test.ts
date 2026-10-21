import { describe, expect, it } from "vitest";
import {
  checkGitHub,
  checkLinear,
  checkPrivilege,
  checkSupabase,
  checkTools,
  checkVercel,
  healthy,
  TARGETS,
  type Context,
  type Http,
  type Runner,
} from "../../../../scripts/doctor/checks.mts";

const SECRET = "tok_must_never_appear_0123456789";

/** Commands answer from a table; anything unlisted fails, like a missing tool. */
function runner(answers: Record<string, string>): Runner {
  return (command, args) => {
    const key = [command, ...args].join(" ");
    const match = Object.keys(answers).find((prefix) => key.startsWith(prefix));
    return match === undefined
      ? { status: 1, stdout: "" }
      : { status: 0, stdout: answers[match] ?? "" };
  };
}

const httpReturning =
  (status: number, json: unknown): Http =>
  async () => ({ status, json });

function context(overrides: Partial<Context> = {}): Context {
  return {
    run: runner({
      "npm --version": "11.17.0",
      "git --version": "git version 2.50.0",
      "docker version": "29.0.0",
      "git remote get-url origin": "https://github.com/sfan0704/pikachubball.git",
      "gh api": JSON.stringify({ admin: false, push: true, pull: true }),
    }),
    http: httpReturning(500, undefined),
    env: {},
    expectedNode: "24.21.0",
    expectedNpm: "11.17.0",
    nodeVersion: "24.21.0",
    hasEnvLocal: false,
    ...overrides,
  };
}

describe("checkTools", () => {
  it("passes the pinned toolchain", () => {
    expect(checkTools(context()).every((finding) => finding.status === "ok")).toBe(true);
  });

  it("warns on a minor difference but fails a different major or a missing tool", () => {
    const findings = checkTools(
      context({
        nodeVersion: "22.1.0",
        run: runner({ "npm --version": "11.19.0", "docker version": "29.0.0" }),
      })
    );
    const status = Object.fromEntries(findings.map((finding) => [finding.area, finding.status]));

    expect(status).toEqual({ node: "failed", npm: "warning", git: "failed", docker: "ok" });
  });

  it("reports Docker as unavailable rather than failing everything", () => {
    const findings = checkTools(
      context({ run: runner({ "npm --version": "11.17.0", "git --version": "git" }) })
    );

    expect(findings.find((finding) => finding.area === "docker")?.status).toBe("unavailable");
  });
});

describe("checkGitHub", () => {
  it("accepts this repository with write access", async () => {
    const findings = await checkGitHub(context());

    expect(findings.map((finding) => finding.status)).toEqual(["ok", "ok"]);
  });

  it("flags a checkout of another repository", async () => {
    const run = runner({ "git remote get-url origin": "git@github.com:someone/fork.git" });

    const [remote] = await checkGitHub(context({ run }));

    expect(remote).toMatchObject({ status: "mismatch", detail: "someone/fork" });
  });

  it("says how to get access when neither gh nor a token works, and treats a 403 the same", async () => {
    const run = runner({ "git remote get-url origin": "https://github.com/sfan0704/pikachubball" });
    const restricted = context({
      run,
      env: { GITHUB_TOKEN: SECRET },
      http: httpReturning(403, { message: "no" }),
    });

    const findings = [...(await checkGitHub(context({ run }))), ...(await checkGitHub(restricted))];

    expect(
      findings.filter((finding) => finding.area === "github").map((finding) => finding.status)
    ).toEqual(["unavailable", "unavailable"]);
  });

  it("warns that admin is more than a worker needs", async () => {
    const run = runner({
      "git remote get-url origin": "https://github.com/sfan0704/pikachubball",
      "gh api": JSON.stringify({ admin: true, push: true, pull: true }),
    });

    const findings = await checkGitHub(context({ run }));

    expect(findings[1]?.status).toBe("warning");
  });
});

describe("checkLinear", () => {
  const withKey = (http: Http) => context({ env: { LINEAR_API_KEY: SECRET }, http });

  it("is unavailable without a key, and when the key is rejected", async () => {
    expect((await checkLinear(context())).status).toBe("unavailable");
    expect((await checkLinear(withKey(httpReturning(401, {})))).status).toBe("unavailable");
  });

  it("flags a key from a workspace without the FAN team", async () => {
    const finding = await checkLinear(
      withKey(httpReturning(200, { data: { teams: { nodes: [] } } }))
    );

    expect(finding.status).toBe("mismatch");
  });

  it("passes a key that can read the team", async () => {
    const finding = await checkLinear(
      withKey(httpReturning(200, { data: { teams: { nodes: [{ key: "FAN" }] } } }))
    );

    expect(finding.status).toBe("ok");
  });
});

describe("checkSupabase", () => {
  const withProjects = (projects: unknown) =>
    context({ env: { SUPABASE_ACCESS_TOKEN: SECRET }, http: httpReturning(200, projects) });

  it("needs no token for local work", async () => {
    expect((await checkSupabase(context())).status).toBe("ok");
  });

  it("warns when a worker's token can reach production", async () => {
    const finding = await checkSupabase(
      withProjects([{ id: "otherproject" }, { id: TARGETS.supabaseProd }])
    );

    expect(finding.status).toBe("warning");
  });

  it("passes a token that can't reach production", async () => {
    expect((await checkSupabase(withProjects([{ id: "otherproject" }]))).status).toBe("ok");
  });
});

describe("checkVercel", () => {
  const withToken = (http: Http) => context({ env: { VERCEL_TOKEN: SECRET }, http });

  it("points to GitHub deployments when there's no token", async () => {
    const finding = await checkVercel(context());

    expect(finding.status).toBe("unavailable");
    expect(finding.action).toContain("deployments");
  });

  it("flags a token for another team and passes the right one", async () => {
    expect((await checkVercel(withToken(httpReturning(403, {})))).status).toBe("mismatch");
    expect((await checkVercel(withToken(httpReturning(200, {})))).status).toBe("ok");
  });
});

describe("checkPrivilege", () => {
  it("names production-write secrets that are set, never their values", () => {
    const findings = checkPrivilege(
      context({ env: { SUPABASE_DB_PASSWORD: SECRET, PATH: "/bin" }, hasEnvLocal: true })
    );

    expect(findings[0]).toMatchObject({ status: "warning", detail: "set: SUPABASE_DB_PASSWORD" });
    expect(findings[1]?.area).toBe(".env.local");
  });
});

describe("the whole report", () => {
  it("never contains a token or environment value, whatever the outcome", async () => {
    const env = {
      GITHUB_TOKEN: SECRET,
      LINEAR_API_KEY: SECRET,
      SUPABASE_ACCESS_TOKEN: SECRET,
      VERCEL_TOKEN: SECRET,
      SUPABASE_DB_PASSWORD: SECRET,
    };
    for (const http of [
      httpReturning(200, { echoed: SECRET }),
      httpReturning(403, { echoed: SECRET }),
    ]) {
      const ctx = context({ env, http });
      const findings = [
        ...checkTools(ctx),
        ...(await checkGitHub(ctx)),
        await checkLinear(ctx),
        await checkSupabase(ctx),
        await checkVercel(ctx),
        ...checkPrivilege(ctx),
      ];

      expect(JSON.stringify(findings)).not.toContain(SECRET);
    }
  });

  it("is healthy unless something failed or points at the wrong target", () => {
    expect(
      healthy([
        { area: "a", status: "warning", detail: "" },
        { area: "b", status: "unavailable", detail: "" },
      ])
    ).toBe(true);
    expect(healthy([{ area: "a", status: "mismatch", detail: "" }])).toBe(false);
    expect(healthy([{ area: "a", status: "failed", detail: "" }])).toBe(false);
  });
});
