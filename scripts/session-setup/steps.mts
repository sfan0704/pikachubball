// The steps behind `npm run session:setup` (scripts/session-setup.mts). They
// take every command and file through a Context, so tests can use fakes. This
// runs before dependencies are installed, so it imports no packages (not even
// zod) and narrows the lockfiles by hand.

/** What setup may touch: commands, files under the checkout, and its own output. */
export interface Context {
  /**
   * Runs a command quietly, with `bin` first on PATH when given; only the exit
   * status and stdout come back, never echoed.
   */
  readonly run: (
    command: string,
    args: readonly string[],
    bin?: string
  ) => { status: number | null; stdout: string };
  /** Runs a command with its output shown, returning the exit status. */
  readonly runShown: (command: string, args: readonly string[], bin?: string) => number | null;
  /** A file's text, or undefined when it doesn't exist. */
  readonly read: (path: string) => string | undefined;
  readonly exists: (path: string) => boolean;
  readonly append: (path: string, text: string) => void;
  readonly log: (line: string) => void;
  /** The Node running this command, and the directory its binary is in. */
  readonly nodeVersion: string;
  readonly nodeBin: string;
  /** Where nvm lives, if this machine has it. */
  readonly nvmDir: string | undefined;
  /** Whether a locally installed Chrome stands in for Playwright's Chromium (PW_CHANNEL). */
  readonly chromeChannel: boolean;
  /** Whether setup runs as root, as in a cloud container, so it may start a daemon itself. */
  readonly root: boolean;
  /** Starts a long-running command in the background, its output going to `log`. */
  readonly startDetached: (command: string, args: readonly string[], log: string) => void;
  /** Where a daemon setup starts writes its output. */
  readonly daemonLog: string;
}

/** The Node setup uses: its version, its bin directory, and whether it is already on PATH. */
export interface Node {
  readonly version: string;
  readonly bin: string;
  /** False exactly when setup got this Node from nvm rather than using the running one. */
  readonly onPath: boolean;
}

/** Options from the command line. */
export interface Options {
  /** A file the host's later shells source; setup adds the pinned Node to PATH there. */
  readonly pathFile: string | undefined;
}

const major = (version: string): string => version.split(".")[0] ?? "";
const VERSION = /^\d+\.\d+\.\d+$/;

/** `--path-file <file>`; an empty file name (an unset host variable) means none. */
export function parseOptions(args: readonly string[]): Options {
  if (args.length === 0) return { pathFile: undefined };
  if (args.length === 2 && args[0] === "--path-file") return { pathFile: args[1] || undefined };
  throw new Error(
    `Unknown arguments: ${args.join(" ")}. Usage: session:setup [--path-file <file>]`
  );
}

/** The pinned Node and npm versions, from .nvmrc and packageManager. */
export function pins(ctx: Context): { node: string; npm: string } {
  const node = ctx.read(".nvmrc")?.trim() ?? "";
  if (!VERSION.test(node)) throw new Error(".nvmrc must hold an exact Node version.");
  const manifest: unknown = JSON.parse(ctx.read("package.json") ?? "{}");
  const pinned =
    typeof manifest === "object" && manifest !== null && "packageManager" in manifest
      ? manifest.packageManager
      : undefined;
  const npm = typeof pinned === "string" ? pinned.replace(/^npm@/, "") : "";
  if (!VERSION.test(npm)) throw new Error("package.json must pin packageManager to npm@x.y.z.");
  return { node, npm };
}

/**
 * The running Node when its major matches the pin; otherwise the pinned version
 * from nvm, installing it if needed. With neither, setup refuses.
 */
export function resolveNode(ctx: Context, pinned: string): Node {
  if (major(ctx.nodeVersion) === major(pinned)) {
    if (ctx.nodeVersion !== pinned) {
      ctx.log(`Warning: Node ${ctx.nodeVersion} is running; .nvmrc pins ${pinned}.`);
    }
    return { version: ctx.nodeVersion, bin: ctx.nodeBin, onPath: true };
  }
  const refusal = `Node ${ctx.nodeVersion} is running, but this repository needs Node ${pinned} (.nvmrc).`;
  if (!ctx.nvmDir || !ctx.exists(`${ctx.nvmDir}/nvm.sh`)) {
    throw new Error(`${refusal} Install it (for example \`nvm install\`) and run setup again.`);
  }
  // nvm is a shell function, so it runs inside bash; the version is an argument, never spliced in.
  // --no-use: loading nvm otherwise switches to its default alias, and fails when that is missing.
  const nvm = (command: string): string[] => [
    "-c",
    `export NVM_DIR="$1"; . "$NVM_DIR/nvm.sh" --no-use >/dev/null; nvm ${command} "$2"`,
    "nvm",
    ctx.nvmDir ?? "",
    pinned,
  ];
  let found = ctx.run("bash", nvm("which"));
  if (found.status !== 0) {
    ctx.log(`Installing Node ${pinned} with nvm.`);
    if (ctx.runShown("bash", nvm("install")) !== 0) {
      throw new Error(`${refusal} \`nvm install ${pinned}\` failed.`);
    }
    found = ctx.run("bash", nvm("which"));
  }
  const binary = found.stdout.trim().split("\n").pop() ?? "";
  if (found.status !== 0 || !binary.endsWith("/node")) {
    throw new Error(`${refusal} nvm did not provide it.`);
  }
  return { version: pinned, bin: binary.slice(0, -"/node".length), onPath: false };
}

function npmVersion(ctx: Context, node: Node): string {
  const result = ctx.run(`${node.bin}/npm`, ["--version"], node.bin);
  return result.status === 0 ? result.stdout.trim() : "missing";
}

/**
 * npm from the chosen Node: the pinned major is required. When setup got that
 * Node from nvm, the exact pin is installed into it, since nothing else uses
 * that install; any other npm belongs to the person or image, so a different
 * version there is only warned about.
 */
export function checkNpm(ctx: Context, node: Node, pinned: string): string {
  const version = npmVersion(ctx, node);
  if (major(version) !== major(pinned)) {
    throw new Error(`npm ${version} is here, but package.json pins npm@${pinned}.`);
  }
  if (version === pinned) return version;
  if (node.onPath) {
    ctx.log(
      `Warning: npm ${version} is here; packageManager pins ${pinned} (agent:setup needs it exactly).`
    );
    return version;
  }
  ctx.log(`Installing npm ${pinned} into nvm's Node ${node.version} (it has npm ${version}).`);
  const failed = `Installing npm@${pinned} into nvm's Node ${node.version} failed.`;
  if (ctx.runShown(`${node.bin}/npm`, ["install", "--global", `npm@${pinned}`], node.bin) !== 0) {
    throw new Error(failed);
  }
  const installed = npmVersion(ctx, node);
  if (installed !== pinned) throw new Error(`${failed} It reports npm ${installed}.`);
  return installed;
}

interface LockEntry {
  readonly version?: unknown;
  readonly optional?: unknown;
  readonly devOptional?: unknown;
}

function packagesOf(lockfile: string | undefined): Record<string, LockEntry> | undefined {
  if (lockfile === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(lockfile);
  } catch {
    // A damaged record of what npm installed means reinstall, not a failed setup.
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || !("packages" in parsed)) return undefined;
  const packages = parsed.packages;
  return typeof packages === "object" && packages !== null
    ? (packages as Record<string, LockEntry>)
    : undefined;
}

/**
 * Whether node_modules already holds exactly what package-lock.json lists, judged
 * by npm's own record of what it installed (node_modules/.package-lock.json).
 * Optional packages for other platforms may be absent; anything else must match.
 */
export function installedMatches(
  lockfile: string | undefined,
  installed: string | undefined
): boolean {
  const wanted = packagesOf(lockfile);
  const have = packagesOf(installed);
  if (!wanted || !have) return false;
  for (const [path, entry] of Object.entries(wanted)) {
    if (path === "") continue;
    const present = have[path];
    if (!present) {
      if (entry.optional === true || entry.devOptional === true) continue;
      return false;
    }
    if (present.version !== entry.version) return false;
  }
  return Object.keys(have).every((path) => path in wanted);
}

/** `npm ci` unless node_modules already matches the lockfile. */
export function install(ctx: Context, node: Node): void {
  if (
    installedMatches(ctx.read("package-lock.json"), ctx.read("node_modules/.package-lock.json"))
  ) {
    ctx.log("node_modules already matches package-lock.json; nothing installed.");
    return;
  }
  if (ctx.runShown(`${node.bin}/npm`, ["ci"], node.bin) !== 0) throw new Error("npm ci failed.");
}

// Polled in the shell: dockerd takes a few seconds before its socket answers.
const AWAIT_DOCKER =
  "for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1";

/**
 * Starts the Docker daemon when this machine has the engine installed but not
 * running and setup runs as root: a cloud container, where nothing else starts
 * it. A laptop's Docker belongs to its owner and is left alone.
 */
export function startDocker(ctx: Context): void {
  if (ctx.run("docker", ["info"]).status === 0) return;
  if (!ctx.root || ctx.run("sh", ["-c", "command -v dockerd"]).status !== 0) return;
  ctx.log("Starting the Docker daemon.");
  ctx.startDetached("dockerd", [], ctx.daemonLog);
  if (ctx.run("sh", ["-c", AWAIT_DOCKER]).status !== 0) {
    ctx.log(`Warning: the Docker daemon did not answer; its output is in ${ctx.daemonLog}.`);
  }
}

/** Docker and Chromium, which decide the validate profiles that can run here. */
export function capabilities(ctx: Context, node: Node): { docker: boolean; chromium: boolean } {
  const docker = ctx.run("docker", ["info"]).status === 0;
  const probe =
    "const p=require('playwright').chromium.executablePath();" +
    "process.stdout.write(require('fs').existsSync(p)?'yes':'no')";
  const chromium =
    ctx.chromeChannel || ctx.run(`${node.bin}/node`, ["-e", probe], node.bin).stdout === "yes";
  return { docker, chromium };
}

/** Which validate profiles run here and which are left to CI, as lines to print. */
export function profileSummary(caps: { docker: boolean; chromium: boolean }): string[] {
  const here = ["static", "unit", "build"];
  const ci: string[] = [];
  if (caps.docker) here.push("database");
  else ci.push("database (needs Docker)");
  if (caps.docker && caps.chromium) here.push("browser");
  else ci.push(`browser (needs ${caps.docker ? "Chromium" : "Docker"})`);
  const lines = [`Validate profiles here: ${here.join(", ")}`];
  if (ci.length > 0) lines.push(`Left to CI: ${ci.join(", ")}; review:start needs Docker too`);
  if (caps.docker) {
    lines.push(
      "Docker is here: `npm run agent:setup` builds and smoke-tests this checkout's stack."
    );
  }
  return lines;
}

/** Puts a Node that isn't on PATH there, through the host's env file when it gives one. */
export function exportNode(ctx: Context, node: Node, options: Options): void {
  if (node.onPath) return;
  if (!options.pathFile) {
    ctx.log(`Node ${node.version} is installed but not on PATH: run \`nvm use\` in your shell.`);
    return;
  }
  const line = `export PATH="${node.bin}:$PATH"\n`;
  if (!(ctx.read(options.pathFile) ?? "").includes(line)) ctx.append(options.pathFile, line);
  ctx.log(`Node ${node.version} goes on PATH for this session's shells.`);
}

/** The whole setup. Throws with a message saying what to fix; nothing secret is ever printed. */
export function sessionSetup(ctx: Context, options: Options): void {
  const pinned = pins(ctx);
  const node = resolveNode(ctx, pinned.node);
  const npm = checkNpm(ctx, node, pinned.npm);
  install(ctx, node);
  startDocker(ctx);
  const caps = capabilities(ctx, node);
  exportNode(ctx, node, options);
  ctx.log(
    `Session setup: Node ${node.version}, npm ${npm}, Docker ${caps.docker ? "reachable" : "not reachable"}, Chromium ${caps.chromium ? "installed" : "not installed"}.`
  );
  for (const line of profileSummary(caps)) ctx.log(line);
}
