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

const get = (path) => fetch(new URL(path, baseUrl), { redirect: "manual" });

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
