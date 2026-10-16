import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { contractSchema } from "../../../../scripts/config-check/contracts.mts";

const run = promisify(execFile);
const directories: string[] = [];
const SECRET = "synthetic-config-token-and-value";
const contract = contractSchema.parse(
  JSON.parse(readFileSync("config/hosted-contract.json", "utf8"))
);
const metadata = {
  projectId: contract.vercelProjectId,
  teamId: contract.vercelTeamId,
  variables: [{ key: "APP_ORIGIN", target: ["production"], gitBranch: null }],
};

afterEach(() => Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true }))));

async function capture(explicitFile: boolean) {
  const directory = await mkdtemp(join(tmpdir(), "config-vercel-"));
  directories.push(directory);
  const output = join(directory, "snapshot.json");
  const preloader = join(directory, "transport.mjs");
  // All requests in the subprocess are intercepted; these tests never reach Vercel.
  await writeFile(
    preloader,
    explicitFile
      ? "globalThis.fetch = async () => { throw new Error('Unexpected network request'); };"
      : `globalThis.fetch = async (url) => Response.json(String(url).includes('/env?')
          ? ${JSON.stringify({ envs: [{ ...metadata.variables[0], value: SECRET }] })}
          : ${JSON.stringify({ id: metadata.projectId, accountId: metadata.teamId })});`
  );
  const args = [
    "--import",
    pathToFileURL(preloader).href,
    "scripts/config-check/capture.mts",
    "prod",
    output,
  ];
  if (explicitFile) {
    const auth = join(directory, "auth.json");
    const vercel = join(directory, "vercel.json");
    await writeFile(
      auth,
      JSON.stringify({ siteUrl: "https://example.test", redirectAllowList: [] })
    );
    await writeFile(vercel, JSON.stringify(metadata));
    args.push(auth, vercel);
  }
  let exitCode = 0;
  let logs = "";
  try {
    const result = await run(process.execPath, args, {
      env: { ...process.env, CONFIG_VERCEL_TOKEN: SECRET, CONFIG_SUPABASE_ACCESS_TOKEN: "" },
    });
    logs = result.stdout + result.stderr;
  } catch (error) {
    const failure = error as { code: number; stdout: string; stderr: string };
    exitCode = failure.code;
    logs = failure.stdout + failure.stderr;
  }
  return { output: await readFile(output, "utf8"), exitCode, logs };
}

describe("configuration capture Vercel source selection", () => {
  it("acquires live metadata when a token is supplied, without passing missing sources", async () => {
    const result = await capture(false);
    expect(JSON.parse(result.output)).toMatchObject({
      vercel: metadata,
      auth: null,
      providers: null,
      database: null,
    });
    expect(result.exitCode).toBe(1);
    expect(result.output + result.logs).not.toContain(SECRET);
  });

  it("uses an explicit trusted file before a token and makes no network request", async () => {
    const result = await capture(true);
    expect(JSON.parse(result.output).vercel).toEqual(metadata);
    expect(result.exitCode).toBe(1);
    expect(result.logs).toContain("missing sources remain unavailable");
    expect(result.output + result.logs).not.toContain(SECRET);
  });
});
