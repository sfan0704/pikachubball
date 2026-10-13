// The review environment (docs/target-state.md, "Review environment"): the
// exact commit's build with this checkout's own throwaway stack, synthetic
// managers and the Yahoo stand-in, on loopback only.
//
//   npm run review:start    build, start, wait for health; prints the record as JSON
//   npm run review:status   the record, and whether it's running, healthy or expired
//   npm run review:stop     stops this checkout's review and stack; safe to repeat
//
// It lives for REVIEW_LIFETIME_MINUTES (default 120) and then stops itself.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { workspace } from "./workspace.mts";
import {
  expired,
  hostedConfiguration,
  lifetimeMinutes,
  newRecord,
  parseRecord,
  type ReviewRecord,
} from "./review/lifecycle.mts";

const ws = workspace();
process.chdir(ws.root);
const RECORD = join(ws.workdir, "review.json");
const LOG = join(ws.workdir, "review.log");
const START_TIMEOUT_MS = 20 * 60_000;

// Only what the tools need, so no hosted configuration reaches the app.
function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "CI", "DOCKER_HOST"].flatMap((name) =>
      process.env[name] ? [[name, process.env[name]]] : []
    )
  );
  env.PATH = `${join(ws.root, "node_modules", ".bin")}:${env.PATH ?? ""}`;
  return { ...env, ...extra };
}

function git(args: readonly string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function readRecord(): ReviewRecord | undefined {
  return existsSync(RECORD) ? parseRecord(readFileSync(RECORD, "utf8")) : undefined;
}

/** Whether the recorded process group is alive and is this checkout's dev-local run. */
function ours(record: ReviewRecord): boolean {
  const command = spawnSync("ps", ["-o", "command=", "-p", String(record.pid)], {
    encoding: "utf8",
  });
  return command.status === 0 && command.stdout.includes("scripts/dev-local.sh --built");
}

async function healthyAt(url: string, commit: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) });
    const body: unknown = await response.json();
    return (
      response.ok &&
      typeof body === "object" &&
      body !== null &&
      (body as { commit?: unknown }).commit === commit
    );
  } catch {
    return false;
  }
}

const WATCHER = `${join(ws.root, "scripts", "review.mts")} expire`;

/** Ends this checkout's expiry watchers (matched by full path, so never another checkout's), except this process. */
function stopWatchers(): void {
  const found = spawnSync("pgrep", ["-f", WATCHER], { encoding: "utf8" });
  const pids = found.stdout.split("\n").map(Number);
  for (const pid of pids.filter((each) => each > 0 && each !== process.pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
}

async function stop(): Promise<void> {
  const record = readRecord();
  if (!record) {
    stopWatchers();
    console.log("No review is running in this checkout.");
    return;
  }
  if (ours(record)) {
    process.kill(-record.pid, "SIGTERM");
    for (let attempt = 0; attempt < 20 && ours(record); attempt += 1) await pause(500);
  }
  stopWatchers();
  const stopped = spawnSync("bash", ["scripts/stack-stop.sh"], {
    stdio: "inherit",
    env: cleanEnv({}),
  });
  if (stopped.status !== 0) throw new Error("Stopping this checkout's stack failed; see above");
  rmSync(RECORD, { force: true });
  console.log(`Stopped the review of ${record.commit.slice(0, 7)} and this checkout's stack.`);
}

/** Refuses anything that would make the review less than exact and synthetic. */
function preflight(): string {
  const hosted = hostedConfiguration(process.env);
  if (hosted.length > 0) {
    throw new Error(`Refusing to start a review with hosted configuration: ${hosted.join("; ")}`);
  }
  if (git(["status", "--porcelain", "--untracked-files=no"]) !== "") {
    throw new Error("Commit or stash tracked changes first: a review shows one exact commit");
  }
  return git(["rev-parse", "HEAD"]);
}

async function start(): Promise<void> {
  const commit = preflight();
  const minutes = lifetimeMinutes(process.env);
  const existing = readRecord();
  if (existing && ours(existing) && !expired(existing, Date.now()) && existing.commit === commit) {
    console.log(JSON.stringify(existing, null, 2));
    return;
  }
  if (existing) await stop();
  if (
    spawnSync("npm", ["run", "build"], { stdio: ["ignore", 2, 2], env: cleanEnv({}) }).status !== 0
  ) {
    throw new Error("The build failed");
  }
  mkdirSync(ws.workdir, { recursive: true });
  const url = `http://localhost:${ws.ports.review}`;
  const log = openSync(LOG, "w");
  const child = spawn("bash", ["scripts/dev-local.sh", "--built"], {
    detached: true,
    stdio: ["ignore", log, log],
    env: cleanEnv({
      PORT: String(ws.ports.review),
      STANDIN_PORT: String(ws.ports.reviewStandIn),
      VERCEL_GIT_COMMIT_SHA: commit,
    }),
  });
  child.unref();
  const recordAt = (now: number): ReviewRecord =>
    newRecord({
      url,
      commit,
      workspace: ws.projectId,
      pid: child.pid ?? -1,
      now,
      lifetimeMinutes: minutes,
    });
  // Written now so `review:stop` can find the process while it starts.
  writeFileSync(RECORD, `${JSON.stringify(recordAt(Date.now()), null, 2)}\n`);
  // A fresh local stack can take many minutes to initialize on a small Docker VM.
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline && !(await healthyAt(url, commit))) await pause(1000);
  if (!(await healthyAt(url, commit))) {
    await stop();
    throw new Error(
      `The review didn't become healthy within ${START_TIMEOUT_MS / 60_000} minutes; see ${LOG}`
    );
  }
  // The lifetime counts from when the review answers, not from when it began starting.
  const record = recordAt(Date.now());
  writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`);
  // The lifetime limit: a detached watcher stops this review when it expires.
  spawn(process.execPath, [join(ws.root, "scripts", "review.mts"), "expire", record.startedAt], {
    detached: true,
    stdio: "ignore",
    env: cleanEnv({}),
  }).unref();
  console.log(JSON.stringify(record, null, 2));
}

async function status(): Promise<void> {
  const record = readRecord();
  if (!record) {
    console.log(JSON.stringify({ running: false }));
    process.exitCode = 1;
    return;
  }
  const running = ours(record);
  const healthy = running && (await healthyAt(record.url, record.commit));
  console.log(
    JSON.stringify({ ...record, running, healthy, expired: expired(record, Date.now()) }, null, 2)
  );
  process.exitCode = healthy ? 0 : 1;
}

/** Waits out the lifetime, then stops the review it was started for, if that's still the one running. */
async function expire(startedAt: string): Promise<void> {
  const record = readRecord();
  if (!record || record.startedAt !== startedAt) return;
  await pause(Math.max(0, Date.parse(record.expiresAt) - Date.now()));
  if (readRecord()?.startedAt === startedAt) await stop();
}

const [command, argument] = process.argv.slice(2);
const commands: Record<string, () => Promise<void>> = {
  start,
  status,
  stop,
  expire: () => expire(argument ?? ""),
};
const run = command ? commands[command] : undefined;
if (!run) {
  console.error("Usage: node scripts/review.mts start|status|stop");
  process.exitCode = 2;
} else {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
