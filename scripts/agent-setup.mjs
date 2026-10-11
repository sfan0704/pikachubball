#!/usr/bin/env node
// Bounded setup on the supported disposable Linux worker; never loads dotenv.
import { setTimeout, clearTimeout } from "node:timers";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmdirSync, realpathSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const root = realpathSync(resolve(import.meta.dirname, ".."));
process.chdir(root);
const evidenceDir = resolve(root, ".agent");
const expectedNode = readFileSync(".nvmrc", "utf8").trim();
const expectedNpm = JSON.parse(readFileSync("package.json", "utf8")).packageManager.split("@")[1];
const owner = createHash("sha256").update(root).digest("hex");
const ownerVolume = "pikachubball_agent_owner";
const marker = "io.pikachubball.workspace";
const events = [];
// Never propagate hosted app configuration into setup or its children.
const env = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "CI"].filter((k) => process.env[k]).map((k) => [k, process.env[k]])
);
env.PATH = `${root}/node_modules/.bin:${env.PATH}`;
env.VERCEL_GIT_COMMIT_SHA = capture("git", ["rev-parse", "HEAD"]);
let claimed = false;
let locked = false;

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 30_000 });
  if (result.status !== 0)
    throw new Error(`${command} prerequisite failed; verify installation and access.`);
  return result.stdout.trim();
}

async function run(command, args, timeout = 600_000) {
  const started = Date.now();
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", detached: true });
    const kill = () => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    };
    const timer = setTimeout(kill, timeout);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      events.push({
        command: [command, ...args].join(" "),
        passed: code === 0,
        durationMs: Date.now() - started,
      });
      code === 0
        ? resolveRun()
        : reject(
            new Error(`${command} failed or exceeded ${timeout / 1000}s; see the command output.`)
          );
    });
  });
}

async function freePort(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is occupied; use a fresh worker.`)));
    server.listen(port, "127.0.0.1", () => server.close(resolvePort));
  });
}

function claimStack() {
  const volumes = capture("docker", ["volume", "ls", "--format", "{{.Name}}"]).split("\n");
  if (volumes.includes(ownerVolume)) {
    const label = capture("docker", [
      "volume",
      "inspect",
      ownerVolume,
      "--format",
      `{{index .Labels "${marker}"}}`,
    ]);
    if (label !== owner)
      throw new Error("The disposable stack belongs to another checkout; use a fresh Docker host.");
  } else {
    const containers = capture("docker", ["ps", "-a", "--format", "{{.Names}}"]).split("\n");
    if ([...containers, ...volumes].some((name) => name.endsWith("_pikachubball"))) {
      throw new Error(
        "An unowned pikachubball stack exists; refusing to reset it. Use a fresh Docker host."
      );
    }
    capture("docker", ["volume", "create", "--label", `${marker}=${owner}`, ownerVolume]);
  }
  const verifiedOwner = capture("docker", [
    "volume",
    "inspect",
    ownerVolume,
    "--format",
    `{{index .Labels "${marker}"}}`,
  ]);
  if (verifiedOwner !== owner)
    throw new Error("Another checkout claimed the stack; refusing to continue.");
  claimed = true;
}

async function main() {
  if (process.platform !== "linux")
    throw new Error(
      "Supported setup runtime: Ubuntu 24.04 with a dedicated Linux Docker engine. See docs/agent-setup.md."
    );
  if (process.versions.node !== expectedNode)
    throw new Error(`Use Node ${expectedNode} from .nvmrc.`);
  const npm = capture("npm", ["--version"]);
  if (npm !== expectedNpm) throw new Error(`Use npm ${expectedNpm} from packageManager.`);
  if (existsSync(".env.local"))
    throw new Error(
      "Setup requires a clean checkout without .env.local; do not copy hosted configuration."
    );
  const docker = capture("docker", ["version", "--format", "{{.Server.Version}}"]);
  capture("docker", ["info"]);
  await Promise.all([5072, 5098].map(freePort));
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(resolve(evidenceDir, "setup.lock"));
  locked = true;
  claimStack();
  await run("npm", ["ci"]);
  await run("npx", ["--no-install", "playwright", "install", "--with-deps", "chromium"]);
  await run("npm", ["run", "build"]);
  await run("bash", ["scripts/dev-local.sh", "--smoke"]);
  writeFileSync(
    resolve(evidenceDir, "setup.json"),
    JSON.stringify(
      {
        commit: env.VERCEL_GIT_COMMIT_SHA,
        node: process.versions.node,
        npm,
        docker,
        platform: process.platform,
        events,
        passed: true,
      },
      null,
      2
    ) + "\n"
  );
  console.log(
    "Setup passed: migrations, seeds, build, health and synthetic sign-in. Evidence: .agent/setup.json"
  );
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (claimed && existsSync("node_modules/.bin/supabase")) {
    try {
      await run("supabase", ["stop", "--no-backup"], 120_000);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
  if (locked) rmdirSync(resolve(evidenceDir, "setup.lock"));
}
