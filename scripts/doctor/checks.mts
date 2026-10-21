// The read-only checks behind `npm run doctor` (scripts/doctor.mts). Each takes
// its commands and network calls as arguments, so tests can use fakes. Nothing
// here prints, returns or logs a token, an environment value or a response body:
// only statuses, versions and the identities a worker is meant to target.

/** The identities this repository's work must target (docs/integration-access.md). */
export const TARGETS = {
  repository: "sfan0704/pikachubball",
  linearTeam: "FAN",
  supabaseProd: "fpdwtpwpmxsbgjxizuxa",
  vercelProject: "prj_izIWbhRIRM77Kij7YoH8e8ciBkPT",
  vercelTeam: "team_h0Yl4tlqpwkycY1Wl2ZppyOo",
} as const;

/**
 * - ok: works and targets the right identity
 * - unavailable: not set up here; the action says how to get it
 * - mismatch: set up, but pointing at something else
 * - failed: a required local tool is missing or wrong
 * - warning: works, but holds more than a normal worker should
 */
export type Status = "ok" | "unavailable" | "mismatch" | "failed" | "warning";

export interface Finding {
  readonly area: string;
  readonly status: Status;
  readonly detail: string;
  readonly action?: string;
}

/** Runs a command; only the exit status and stdout come back, never echoed. */
export type Runner = (
  command: string,
  args: readonly string[]
) => { status: number | null; stdout: string };

/** An HTTP GET or POST returning only the status and the parsed JSON body. */
export type Http = (
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string }
) => Promise<{ status: number; json: unknown }>;

export interface Context {
  readonly run: Runner;
  readonly http: Http;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly expectedNode: string;
  readonly expectedNpm: string;
  readonly nodeVersion: string;
  readonly hasEnvLocal: boolean;
}

function versionOf(ctx: Context, command: string, args: readonly string[]): string | undefined {
  const result = ctx.run(command, args);
  return result.status === 0 ? (result.stdout.trim().split("\n")[0] ?? "") : undefined;
}

/** Same major version: usable here, though agent:setup insists on the exact pin. */
function pinned(
  area: string,
  actual: string | undefined,
  expected: string,
  action: string
): Finding {
  if (actual === expected) return { area, status: "ok", detail: actual };
  const sameMajor = actual !== undefined && actual.split(".")[0] === expected.split(".")[0];
  return {
    area,
    status: sameMajor ? "warning" : "failed",
    detail: `${actual ?? "missing"}, pinned ${expected}`,
    action: sameMajor ? `${action}; agent:setup requires the exact version` : action,
  };
}

/** Node, npm, git and Docker: needed for any work in this repository. */
export function checkTools(ctx: Context): Finding[] {
  const findings: Finding[] = [
    pinned("node", ctx.nodeVersion, ctx.expectedNode, "Use the version in .nvmrc"),
    pinned(
      "npm",
      versionOf(ctx, "npm", ["--version"]),
      ctx.expectedNpm,
      "Use packageManager from package.json"
    ),
  ];
  const git = versionOf(ctx, "git", ["--version"]);
  findings.push(
    git
      ? { area: "git", status: "ok", detail: git }
      : { area: "git", status: "failed", detail: "missing", action: "Install git" }
  );
  const docker = versionOf(ctx, "docker", ["version", "--format", "{{.Server.Version}}"]);
  findings.push(
    docker
      ? { area: "docker", status: "ok", detail: `engine ${docker}` }
      : {
          area: "docker",
          status: "unavailable",
          detail: "no engine reachable",
          action: "Start Docker; database and browser checks need it",
        }
  );
  return findings;
}

/** The checkout's remote and what this worker may do on GitHub (via gh, or GITHUB_TOKEN). */
export async function checkGitHub(ctx: Context): Promise<Finding[]> {
  const remote = ctx.run("git", ["remote", "get-url", "origin"]);
  const slug = /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(remote.stdout.trim())?.[1];
  const findings: Finding[] = [
    slug === TARGETS.repository
      ? { area: "git remote", status: "ok", detail: slug }
      : {
          area: "git remote",
          status: "mismatch",
          detail: slug ?? "no GitHub origin",
          action: `Work in a checkout of ${TARGETS.repository}`,
        },
  ];
  let permissions: unknown;
  const gh = ctx.run("gh", ["api", `repos/${TARGETS.repository}`, "--jq", ".permissions"]);
  if (gh.status === 0) {
    try {
      permissions = JSON.parse(gh.stdout);
    } catch {
      permissions = undefined;
    }
  } else if (ctx.env.GITHUB_TOKEN) {
    const response = await ctx.http(`https://api.github.com/repos/${TARGETS.repository}`, {
      headers: {
        authorization: `Bearer ${ctx.env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
      },
    });
    if (response.status === 200 && typeof response.json === "object" && response.json !== null) {
      permissions = (response.json as { permissions?: unknown }).permissions;
    }
  }
  if (typeof permissions !== "object" || permissions === null) {
    findings.push({
      area: "github",
      status: "unavailable",
      detail: "can't read the repository through gh or GITHUB_TOKEN",
      action:
        "Run `gh auth login`, or provide a GITHUB_TOKEN with contents:read and pull_requests:write",
    });
    return findings;
  }
  const can = permissions as Record<string, boolean>;
  const level = can.admin ? "admin" : can.push ? "write" : can.pull ? "read" : "none";
  findings.push(
    level === "admin"
      ? {
          area: "github",
          status: "warning",
          detail: "admin on the repository",
          action: "A worker needs only write (push branches, open PRs)",
        }
      : {
          area: "github",
          status: level === "none" ? "unavailable" : "ok",
          detail: `${level} on the repository`,
        }
  );
  return findings;
}

/** Linear through LINEAR_API_KEY. An agent's Linear connector can't be checked from a script. */
export async function checkLinear(ctx: Context): Promise<Finding> {
  const key = ctx.env.LINEAR_API_KEY;
  if (!key) {
    return {
      area: "linear",
      status: "unavailable",
      detail: "no LINEAR_API_KEY (an agent's Linear connector isn't visible here)",
      action: "Use the session's Linear connector, or set a read-only LINEAR_API_KEY",
    };
  }
  const response = await ctx.http("https://api.linear.app/graphql", {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json" },
    body: JSON.stringify({
      query: `{ teams(filter: { key: { eq: "${TARGETS.linearTeam}" } }) { nodes { key } } }`,
    }),
  });
  if (response.status !== 200) {
    return {
      area: "linear",
      status: "unavailable",
      detail: `HTTP ${response.status}`,
      action: `Check the key is valid and can read the ${TARGETS.linearTeam} team`,
    };
  }
  const nodes =
    (response.json as { data?: { teams?: { nodes?: { key: string }[] } } }).data?.teams?.nodes ??
    [];
  return nodes.some((team) => team.key === TARGETS.linearTeam)
    ? { area: "linear", status: "ok", detail: `can read team ${TARGETS.linearTeam}` }
    : {
        area: "linear",
        status: "mismatch",
        detail: `key can't see team ${TARGETS.linearTeam}`,
        action: `Use a key from the workspace that holds ${TARGETS.linearTeam}`,
      };
}

/** Supabase management access: optional, metadata only, never needed for local work. */
export async function checkSupabase(ctx: Context): Promise<Finding> {
  const token = ctx.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    return { area: "supabase", status: "ok", detail: "no management token; local work needs none" };
  }
  const response = await ctx.http("https://api.supabase.com/v1/projects", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status !== 200 || !Array.isArray(response.json)) {
    return {
      area: "supabase",
      status: "unavailable",
      detail: `management API HTTP ${response.status}`,
      action: "Check SUPABASE_ACCESS_TOKEN",
    };
  }
  const refs = new Set(
    (response.json as { ref?: string; id?: string }[]).map((project) => project.ref ?? project.id)
  );
  return refs.has(TARGETS.supabaseProd)
    ? {
        area: "supabase",
        status: "warning",
        detail: "token can reach the production project",
        action:
          "Normal work needs no hosted project; keep production access to the owner and Deploy workflow",
      }
    : { area: "supabase", status: "ok", detail: "token can't reach the production project" };
}

/** Vercel project metadata through VERCEL_TOKEN; deployment status is also on GitHub. */
export async function checkVercel(ctx: Context): Promise<Finding> {
  const token = ctx.env.VERCEL_TOKEN;
  if (!token) {
    return {
      area: "vercel",
      status: "unavailable",
      detail: "no VERCEL_TOKEN",
      action:
        "Deployment status is readable on GitHub (`gh api repos/sfan0704/pikachubball/deployments`); runtime logs need Vercel access from the owner",
    };
  }
  const response = await ctx.http(
    `https://api.vercel.com/v9/projects/${TARGETS.vercelProject}?teamId=${TARGETS.vercelTeam}`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (response.status === 200)
    return { area: "vercel", status: "ok", detail: "can read the pikachubball project" };
  return response.status === 403 || response.status === 404
    ? {
        area: "vercel",
        status: "mismatch",
        detail: `HTTP ${response.status} for the pikachubball project`,
        action: "Use a token scoped to the sfan0704s-projects team",
      }
    : {
        area: "vercel",
        status: "unavailable",
        detail: `HTTP ${response.status}`,
        action: "Check VERCEL_TOKEN",
      };
}

// Names only: values are never read. A normal worker holds none of these.
const PRIVILEGED = [
  "SUPABASE_DB_PASSWORD",
  "MAINTENANCE_DB_PASSWORD",
  "ENCRYPTION_KEY",
  "ENCRYPTION_KEY_PREVIOUS",
  "YAHOO_CLIENT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/** Production-write material in this environment, and hosted configuration in the checkout. */
export function checkPrivilege(ctx: Context): Finding[] {
  const held = PRIVILEGED.filter((name) => ctx.env[name]);
  const findings: Finding[] = [
    held.length === 0
      ? { area: "privileged secrets", status: "ok", detail: "none in this environment" }
      : {
          area: "privileged secrets",
          status: "warning",
          detail: `set: ${held.join(", ")}`,
          action: "Normal work needs none of these; leave them to the owner and Deploy workflow",
        },
  ];
  if (ctx.hasEnvLocal) {
    findings.push({
      area: ".env.local",
      status: "warning",
      detail: "hosted configuration present in this checkout",
      action: "Fine on the owner's machine; never copy it to a worker (agent:setup refuses it)",
    });
  }
  return findings;
}

/** Whether the worker can proceed: no failed tool and no wrong target. */
export function healthy(findings: readonly Finding[]): boolean {
  return findings.every((finding) => finding.status !== "failed" && finding.status !== "mismatch");
}
