import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  installedMatches,
  parseOptions,
  profileSummary,
  sessionSetup,
  type Context,
} from "../../../../scripts/session-setup/steps.mts";

const ROOT = join(__dirname, "..", "..", "..", "..");
const COMMAND = "npm run session:setup";
const SECRET = "tok_must_never_appear_0123456789";

const LOCK = JSON.stringify({
  packages: {
    "": { name: "app" },
    "node_modules/zod": { version: "3.24.2" },
    "node_modules/@esbuild/darwin-arm64": { version: "0.28.2", optional: true },
  },
});
const INSTALLED = JSON.stringify({
  packages: { "node_modules/zod": { version: "3.24.2" } },
});

interface Fake extends Context {
  readonly lines: string[];
  readonly shown: string[];
  readonly appended: Record<string, string>;
  readonly started: string[];
  /** Every command run through `run`, in order. */
  readonly ran: string[];
}

/** A checkout and machine; commands answer from a table, anything unlisted fails. */
function fake(overrides: {
  files?: Record<string, string>;
  answers?: Record<string, string>;
  nodeVersion?: string;
  nvmDir?: string;
  shownStatus?: number;
  /** Answers that replace earlier ones once a shown command succeeds, as an install would. */
  afterShown?: Record<string, string>;
  root?: boolean;
  /** Answers that replace earlier ones once a daemon starts. */
  afterStart?: Record<string, string>;
}): Fake {
  const files: Record<string, string> = {
    ".nvmrc": "24.21.0\n",
    "package.json": JSON.stringify({ packageManager: "npm@11.17.0" }),
    "package-lock.json": LOCK,
    "node_modules/.package-lock.json": INSTALLED,
    ...overrides.files,
  };
  const answers: Record<string, string> = {
    "/node24/bin/npm --version": "11.17.0",
    ...overrides.answers,
  };
  const lines: string[] = [];
  const shown: string[] = [];
  const appended: Record<string, string> = {};
  const started: string[] = [];
  const ran: string[] = [];
  return {
    lines,
    shown,
    appended,
    started,
    ran,
    run: (command, args) => {
      const key = [command, ...args].join(" ");
      ran.push(key);
      const match = Object.keys(answers).find((prefix) => key.startsWith(prefix));
      return match === undefined
        ? { status: 1, stdout: "" }
        : { status: 0, stdout: answers[match] ?? "" };
    },
    runShown: (command, args) => {
      shown.push([command, ...args].join(" "));
      const status = overrides.shownStatus ?? 0;
      if (status === 0) Object.assign(answers, overrides.afterShown);
      return status;
    },
    read: (path) => files[path] ?? appended[path],
    exists: (path) => path in files,
    append: (path, text) => {
      appended[path] = (appended[path] ?? "") + text;
    },
    log: (line) => lines.push(line),
    nodeVersion: overrides.nodeVersion ?? "24.21.0",
    nodeBin: "/node24/bin",
    nvmDir: overrides.nvmDir,
    chromeChannel: false,
    root: overrides.root ?? false,
    startDetached: (command, args, log) => {
      started.push(`${[command, ...args].join(" ")} > ${log}`);
      Object.assign(answers, overrides.afterStart);
    },
    daemonLog: "/tmp/dockerd.log",
  };
}

describe("sessionSetup", () => {
  it("installs nothing when node_modules already matches the lockfile", () => {
    const ctx = fake({});
    sessionSetup(ctx, { pathFile: undefined });
    expect(ctx.shown).toEqual([]);
    expect(ctx.lines).toContain(
      "node_modules already matches package-lock.json; nothing installed."
    );
  });

  it("runs npm ci with the pinned Node when node_modules has no usable record", () => {
    for (const installed of ["{}", "not json"]) {
      const ctx = fake({ files: { "node_modules/.package-lock.json": installed } });
      sessionSetup(ctx, { pathFile: undefined });
      expect(ctx.shown).toEqual(["/node24/bin/npm ci"]);
    }
  });

  it("refuses clearly on the wrong Node major when nothing can provide the pin", () => {
    const ctx = fake({ nodeVersion: "22.22.0" });
    expect(() => sessionSetup(ctx, { pathFile: undefined })).toThrow(
      "Node 22.22.0 is running, but this repository needs Node 24.21.0 (.nvmrc)."
    );
    expect(ctx.shown).toEqual([]);
  });

  it("fails when npm ci fails", () => {
    const ctx = fake({ files: { "node_modules/.package-lock.json": "{}" }, shownStatus: 1 });
    expect(() => sessionSetup(ctx, { pathFile: undefined })).toThrow("npm ci failed.");
  });

  it("refuses a different npm major", () => {
    const ctx = fake({ answers: { "/node24/bin/npm --version": "10.9.4" } });
    expect(() => sessionSetup(ctx, { pathFile: undefined })).toThrow(
      "npm 10.9.4 is here, but package.json pins npm@11.17.0."
    );
  });

  it("gets the pinned Node from nvm and puts it on PATH through the host's file, once", () => {
    const answers = {
      "bash -c": "/nvm/versions/node/v24.21.0/bin/node",
      "/nvm/versions/node/v24.21.0/bin/npm --version": "11.17.0",
    };
    const ctx = fake({
      nodeVersion: "22.22.0",
      nvmDir: "/nvm",
      answers,
      files: { "/nvm/nvm.sh": "" },
    });
    sessionSetup(ctx, { pathFile: "/session/env" });
    sessionSetup(ctx, { pathFile: "/session/env" });
    expect(ctx.appended["/session/env"]).toBe(
      'export PATH="/nvm/versions/node/v24.21.0/bin:$PATH"\n'
    );
  });

  describe("npm of a Node from nvm", () => {
    const NVM_NPM = "/nvm/versions/node/v24.21.0/bin/npm";
    const fromNvm = (npm: string, more: Parameters<typeof fake>[0] = {}): Fake =>
      fake({
        nodeVersion: "22.22.0",
        nvmDir: "/nvm",
        files: { "/nvm/nvm.sh": "" },
        ...more,
        answers: {
          "bash -c": "/nvm/versions/node/v24.21.0/bin/node",
          [`${NVM_NPM} --version`]: npm,
        },
      });

    it("installs the pinned npm into that Node, and nothing on a second run", () => {
      const ctx = fromNvm("11.19.0", { afterShown: { [`${NVM_NPM} --version`]: "11.17.0" } });
      sessionSetup(ctx, { pathFile: undefined });
      sessionSetup(ctx, { pathFile: undefined });
      expect(ctx.shown).toEqual([`${NVM_NPM} install --global npm@11.17.0`]);
      expect(ctx.lines).toContain(
        "Session setup: Node 24.21.0, npm 11.17.0, Docker not reachable, Chromium not installed."
      );
    });

    it("fails clearly when installing the pinned npm fails", () => {
      const ctx = fromNvm("11.19.0", { shownStatus: 1 });
      expect(() => sessionSetup(ctx, { pathFile: undefined })).toThrow(
        "Installing npm@11.17.0 into nvm's Node 24.21.0 failed."
      );
    });

    it("fails when the install leaves a different npm", () => {
      const ctx = fromNvm("11.19.0");
      expect(() => sessionSetup(ctx, { pathFile: undefined })).toThrow(
        "Installing npm@11.17.0 into nvm's Node 24.21.0 failed. It reports npm 11.19.0."
      );
    });
  });

  it("only warns about a different npm minor in the Node that was already running", () => {
    const ctx = fake({ answers: { "/node24/bin/npm --version": "11.19.0" } });
    sessionSetup(ctx, { pathFile: undefined });
    expect(ctx.shown).toEqual([]);
    expect(ctx.lines).toContain(
      "Warning: npm 11.19.0 is here; packageManager pins 11.17.0 (agent:setup needs it exactly)."
    );
  });

  it("installs with nvm without depending on nvm's default alias", () => {
    const ctx = fake({ nodeVersion: "22.22.0", nvmDir: "/nvm", files: { "/nvm/nvm.sh": "" } });
    expect(() => sessionSetup(ctx, { pathFile: undefined })).toThrow("nvm did not provide it.");
    // Loading nvm normally switches to its default alias and exits nonzero when that is missing.
    expect(ctx.shown).toHaveLength(1);
    expect(ctx.shown[0]).toContain('nvm.sh" --no-use >/dev/null; nvm install "$2"');
  });

  describe("Docker", () => {
    const DOCKERD = { "sh -c command -v dockerd": "/usr/bin/dockerd" };
    const AWAIT = { "sh -c for _ in": "" };

    it("starts an installed, stopped daemon as root and reports Docker reachable", () => {
      const ctx = fake({
        root: true,
        answers: DOCKERD,
        afterStart: { "docker info": "", ...AWAIT },
      });
      sessionSetup(ctx, { pathFile: undefined });
      expect(ctx.started).toEqual(["dockerd > /tmp/dockerd.log"]);
      expect(ctx.lines).toContain("Starting the Docker daemon.");
      expect(ctx.lines.some((line) => line.includes("Docker reachable"))).toBe(true);
    });

    it("clears a stale pid file before starting, so a resumed container's daemon starts", () => {
      const ctx = fake({ root: true, answers: DOCKERD });
      sessionSetup(ctx, { pathFile: undefined });
      expect(ctx.ran).toContain("sh -c pgrep -x dockerd >/dev/null || rm -f /var/run/docker.pid");
    });

    it("warns, pointing to the daemon's log, when it never answers", () => {
      const ctx = fake({ root: true, answers: DOCKERD });
      sessionSetup(ctx, { pathFile: undefined });
      expect(ctx.lines).toContain(
        "Warning: the Docker daemon did not answer; its output is in /tmp/dockerd.log."
      );
      expect(ctx.lines.some((line) => line.includes("Docker not reachable"))).toBe(true);
    });

    it("leaves Docker alone when it already runs, when not root, or when no engine is installed", () => {
      for (const ctx of [
        fake({ root: true, answers: { "docker info": "", ...DOCKERD } }),
        fake({ root: false, answers: DOCKERD }),
        fake({ root: true }),
      ]) {
        sessionSetup(ctx, { pathFile: undefined });
        expect(ctx.started).toEqual([]);
      }
    });
  });

  it("never reads hosted configuration or prints the environment", () => {
    const read: string[] = [];
    const ctx = fake({});
    const watched = { ...ctx, read: (path: string) => (read.push(path), ctx.read(path)) };
    process.env.SESSION_SETUP_TEST_SECRET = SECRET;
    try {
      sessionSetup(watched, { pathFile: undefined });
    } finally {
      delete process.env.SESSION_SETUP_TEST_SECRET;
    }
    expect(read.some((path) => path.includes(".env"))).toBe(false);
    expect(ctx.lines.join("\n")).not.toContain(SECRET);
    for (const file of ["scripts/session-setup.mts", "scripts/session-setup/steps.mts"]) {
      expect(readFileSync(join(ROOT, file), "utf8")).not.toMatch(/["'`/]\.env/);
    }
  });
});

describe("installedMatches", () => {
  it("allows other platforms' optional packages to be absent", () => {
    expect(installedMatches(LOCK, INSTALLED)).toBe(true);
  });

  it("rejects a missing, different or extra package, or no record at all", () => {
    expect(installedMatches(LOCK, JSON.stringify({ packages: {} }))).toBe(false);
    expect(
      installedMatches(
        LOCK,
        JSON.stringify({ packages: { "node_modules/zod": { version: "3.0.0" } } })
      )
    ).toBe(false);
    const extra = { packages: { ...JSON.parse(INSTALLED).packages, "node_modules/left-pad": {} } };
    expect(installedMatches(LOCK, JSON.stringify(extra))).toBe(false);
    expect(installedMatches(LOCK, undefined)).toBe(false);
    expect(installedMatches(LOCK, "{")).toBe(false);
  });
});

describe("profileSummary", () => {
  it("leaves database and browser to CI without Docker", () => {
    expect(profileSummary({ docker: false, chromium: true })).toEqual([
      "Validate profiles here: static, unit, build",
      "Left to CI: database (needs Docker), browser (needs Docker); review:start needs Docker too",
    ]);
  });

  it("points to agent:setup for Chromium rather than leaving browser to CI", () => {
    expect(profileSummary({ docker: true, chromium: false })).toEqual([
      "Validate profiles here: static, unit, build, database",
      "Docker is here: `npm run agent:setup` builds and smoke-tests this checkout's stack and installs Chromium, so browser runs here after it.",
    ]);
  });

  it("runs everything here with Docker and Chromium, pointing to agent:setup", () => {
    const lines = profileSummary({ docker: true, chromium: true });
    expect(lines[0]).toBe("Validate profiles here: static, unit, build, database, browser");
    expect(lines.join("\n")).toContain("npm run agent:setup");
  });
});

describe("parseOptions", () => {
  it("treats an empty file name, from an unset host variable, as none", () => {
    expect(parseOptions(["--path-file", ""])).toEqual({ pathFile: undefined });
    expect(() => parseOptions(["--verbose"])).toThrow("Unknown arguments");
  });
});

describe("provider adapters", () => {
  /** An adapter may call the command, at most passing the host's PATH file; nothing else. */
  const onlyCallsCommand = (line: string): boolean =>
    line === COMMAND || /^npm run session:setup -- --path-file "\$[A-Z_]+"$/.test(line);

  it("Claude Code's SessionStart hook only calls the command", () => {
    const settings = JSON.parse(readFileSync(join(ROOT, ".claude", "settings.json"), "utf8"));
    expect(Object.keys(settings.hooks)).toEqual(["SessionStart"]);
    const hooks = settings.hooks.SessionStart.flatMap(
      (entry: { hooks: unknown[] }) => entry.hooks
    ) as { type: string; command: string }[];
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.type).toBe("command");
    expect(onlyCallsCommand(hooks[0]?.command ?? "")).toBe(true);
  });

  it("Codex's setup line in the docs only calls the command", () => {
    const docs = readFileSync(join(ROOT, "docs", "agent-setup.md"), "utf8");
    const block = /<!-- codex-setup -->\s*```text\n([\s\S]*?)```/.exec(docs)?.[1] ?? "";
    expect(block.trim().split("\n")).toEqual([COMMAND]);
  });

  it("the adapter check rejects anything more than the command", () => {
    expect(onlyCallsCommand(`${COMMAND} && curl example.com`)).toBe(false);
    expect(onlyCallsCommand(`nvm install; ${COMMAND}`)).toBe(false);
  });
});
