// Bounded setup for a fresh, disposable Linux worker: `npm run agent:setup`.
// Checks the toolchain and Docker, installs the lockfile and Chromium, builds,
// starts this workspace's own stack (scripts/workspace.mts), runs the smoke
// check, stops the stack, and writes sanitized evidence to .agent/setup.json.
// Never loads .env.local or passes hosted configuration to its children.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { workspace } from "./workspace.mts";

interface Step {
  readonly command: string;
  readonly passed: boolean;
  readonly durationMs: number;
}

const ws = workspace();
process.chdir(ws.root);
const evidenceDir = join(ws.root, ".agent");
const lockDir = join(evidenceDir, "setup.lock");
const steps: Step[] = [];
// Set just before the stack starts, so a setup that refuses early stops nothing.
let stackStarted = false;

// Only what the tools need; never hosted app configuration.
const env: NodeJS.ProcessEnv = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "CI", "DOCKER_HOST"].flatMap((name) =>
    process.env[name] ? [[name, process.env[name]]] : []
  )
);
env.PATH = `${join(ws.root, "node_modules", ".bin")}:${env.PATH ?? ""}`;
env.VERCEL_GIT_COMMIT_SHA = capture("git", ["rev-parse", "HEAD"]);

/** A prerequisite command's output; any failure stops setup. */
function capture(command: string, args: readonly string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 30_000 });
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0] ?? ""} failed; check it is installed and reachable.`);
  }
  return result.stdout.trim();
}

/** Runs a step with a time limit, killing its whole process group if it overruns. */
function run(command: string, args: readonly string[], timeoutMs = 600_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolveStep, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", detached: true });
    const timer = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        // Already exited between the timeout firing and the kill.
      }
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      const passed = code === 0;
      steps.push({
        command: [command, ...args].join(" "),
        passed,
        durationMs: Date.now() - started,
      });
      if (passed) {
        resolveStep();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed or exceeded ${timeoutMs / 1000}s.`));
      }
    });
  });
}

/** Refuses to start if something already listens on one of this workspace's ports. */
function requireFree(port: number): Promise<void> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is in use; stop what holds it.`)));
    server.listen(port, "127.0.0.1", () => server.close(() => resolvePort()));
  });
}

/** The supported runtime: Linux, the pinned Node and npm, Docker, and no hosted config. */
async function checkRuntime(): Promise<{ npm: string; docker: string }> {
  if (process.platform !== "linux") {
    throw new Error(
      "Supported setup runtime: Linux with its own Docker engine. See docs/agent-setup.md."
    );
  }
  const node = readFileSync(".nvmrc", "utf8").trim();
  if (process.versions.node !== node) throw new Error(`Use Node ${node} from .nvmrc.`);
  const pinned: unknown = JSON.parse(readFileSync("package.json", "utf8")).packageManager;
  const npm = capture("npm", ["--version"]);
  if (typeof pinned !== "string" || pinned !== `npm@${npm}`) {
    throw new Error(`Use ${String(pinned)} from package.json.`);
  }
  if (existsSync(".env.local")) {
    throw new Error("Setup needs a checkout without .env.local; never copy hosted configuration.");
  }
  const docker = capture("docker", ["version", "--format", "{{.Server.Version}}"]);
  await Promise.all([ws.ports.dev, ws.ports.devStandIn].map(requireFree));
  return { npm, docker };
}

async function main(): Promise<void> {
  const { npm, docker } = await checkRuntime();
  await run("npm", ["ci"]);
  await run("npx", ["--no-install", "playwright", "install", "--with-deps", "chromium"]);
  await run("npm", ["run", "build"]);
  // Starts this workspace's stack (refusing one it doesn't own), migrates, seeds, smoke-tests.
  stackStarted = true;
  await run("bash", ["scripts/dev-local.sh", "--smoke"]);
  const evidence = {
    commit: env.VERCEL_GIT_COMMIT_SHA,
    workspace: ws.projectId,
    node: process.versions.node,
    npm,
    docker,
    platform: process.platform,
    steps,
    passed: true,
  };
  writeFileSync(join(evidenceDir, "setup.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    "Setup passed: build, migrations, seeds, health and synthetic sign-in. Evidence: .agent/setup.json"
  );
}

mkdirSync(evidenceDir, { recursive: true });
// One setup per checkout at a time; a leftover lock means an earlier run is still going or crashed.
mkdirSync(lockDir);
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (stackStarted) {
    try {
      await run("bash", ["scripts/stack-stop.sh"], 120_000);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
  rmdirSync(lockDir);
}
