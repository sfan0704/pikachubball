// Checks a deployment from the outside: `node scripts/smoke-check.mjs <url> [expected-commit]`.
// It reads nothing secret and signs nobody in. Exits non-zero, naming each failed check.
const [, , baseUrl, expectedCommit] = process.argv;
if (!baseUrl) {
  console.error("Usage: node scripts/smoke-check.mjs <url> [expected-commit]");
  process.exit(2);
}

const SECURITY_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
];

// A deployment behind Vercel's protection answers with a login redirect; its
// automation bypass secret, when the repository has one, lets this check through.
const bypass = process.env.SMOKE_BYPASS_SECRET;
const get = async (path) => {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
    headers: bypass ? { "x-vercel-protection-bypass": bypass } : {},
  });
  const location = response.headers.get("location") ?? "";
  // The app's own 401 is JSON; Vercel's protection page is HTML.
  const htmlRefusal =
    response.status === 401 && (response.headers.get("content-type") ?? "").includes("text/html");
  if (htmlRefusal || /vercel\.com\/(sso|login)/.test(location)) {
    throw new Error(
      "the deployment is behind Vercel protection; set the VERCEL_AUTOMATION_BYPASS_SECRET repository secret"
    );
  }
  return response;
};

const checks = [
  [
    "health reports the expected commit",
    async () => {
      const response = await get("/api/health");
      const body = await response.json();
      if (response.status !== 200 || body.status !== "ok") {
        throw new Error(`health answered ${response.status}`);
      }
      if (expectedCommit && body.commit !== expectedCommit) {
        throw new Error(`deployed commit is ${body.commit}, expected ${expectedCommit}`);
      }
    },
  ],
  [
    "protected routes refuse an anonymous request",
    async () => {
      for (const path of ["/api/me", "/api/leagues", "/api/leagues/466.l.1/season"]) {
        const response = await get(path);
        if (response.status !== 401) {
          throw new Error(`${path} answered ${response.status} to an anonymous request`);
        }
      }
    },
  ],
  [
    "deep links load the app",
    async () => {
      for (const path of ["/auth", "/leagues/466.l.1/teams/466.l.1.t.1/season"]) {
        const response = await get(path);
        const html = await response.text();
        if (response.status !== 200 || !html.includes('id="root"')) {
          throw new Error(`${path} did not return the app (${response.status})`);
        }
      }
    },
  ],
  [
    "security headers are present",
    async () => {
      for (const path of ["/auth", "/api/health"]) {
        const response = await get(path);
        const missing = SECURITY_HEADERS.filter((name) => !response.headers.has(name));
        if (missing.length > 0) {
          throw new Error(`${path} is missing ${missing.join(", ")}`);
        }
      }
    },
  ],
];

let failed = false;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok    ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL  ${name}: ${error instanceof Error ? error.message : error}`);
  }
}
process.exit(failed ? 1 : 0);
