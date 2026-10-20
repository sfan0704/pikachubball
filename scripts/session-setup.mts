// `npm run session:setup`: the light, always-safe setup for a cloud session or
// a laptop, the same for every provider. It checks capabilities, never the
// provider: the pinned Node and npm, then `npm ci` unless node_modules already
// matches the lockfile, starts an installed but stopped Docker daemon when it runs
// as root (a cloud container), then which validate profiles run here. It never
// starts a stack, reads hosted configuration or calls a hosted service. Providers'
// adapters only call it (docs/agent-setup.md, Cloud sessions).
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, openSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseOptions, sessionSetup, type Context } from "./session-setup/steps.mts";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

// Where nvm usually lives: the user's NVM_DIR, the per-user default, then shared installs
// (cloud images often keep it in /opt or /usr/local without exporting NVM_DIR to hooks).
const NVM_DIRS = [
  process.env.NVM_DIR,
  join(process.env.HOME ?? "", ".nvm"),
  "/usr/local/nvm",
  "/opt/nvm",
].filter((dir): dir is string => Boolean(dir));

const full = (path: string): string => (isAbsolute(path) ? path : join(ROOT, path));

// What `npm run` exports about the npm and Node that launched setup. They would
// point a different Node's npm (and nvm, which refuses a prefix) at the wrong install.
const LAUNCHER =
  /^npm_(config_(prefix|global_prefix|node_gyp|npm_version|user_agent)|execpath|node_execpath)$/i;

/** This environment for a child, without the launcher's npm settings; with `bin`, that Node first on PATH. */
function envWith(bin: string | undefined): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !LAUNCHER.test(name))
  );
  return bin ? { ...env, PATH: `${bin}:${process.env.PATH ?? ""}` } : env;
}

const ctx: Context = {
  run: (command, args, bin) => {
    const result = spawnSync(command, args, {
      cwd: ROOT,
      env: envWith(bin),
      encoding: "utf8",
      timeout: 60_000,
    });
    return { status: result.error ? null : result.status, stdout: result.stdout ?? "" };
  },
  runShown: (command, args, bin) => {
    // Progress goes to stderr so a host that reads the hook's stdout gets only the summary.
    const result = spawnSync(command, args, {
      cwd: ROOT,
      env: envWith(bin),
      stdio: ["ignore", process.stderr, process.stderr],
      timeout: 600_000,
    });
    return result.error ? null : result.status;
  },
  read: (path) => (existsSync(full(path)) ? readFileSync(full(path), "utf8") : undefined),
  exists: (path) => existsSync(full(path)),
  append: (path, text) => appendFileSync(full(path), text),
  log: (line) => console.log(line),
  nodeVersion: process.versions.node,
  nodeBin: dirname(process.execPath),
  nvmDir: NVM_DIRS.find((dir) => existsSync(join(dir, "nvm.sh"))),
  chromeChannel: Boolean(process.env.PW_CHANNEL),
  root: process.getuid?.() === 0,
  startDetached: (command, args, log) => {
    // Detached and unreferenced, so the daemon outlives setup and the hook can finish.
    const out = openSync(log, "a");
    spawn(command, args, { detached: true, stdio: ["ignore", out, out] }).unref();
  },
  daemonLog: join(tmpdir(), "dockerd.log"),
};

try {
  sessionSetup(ctx, parseOptions(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
