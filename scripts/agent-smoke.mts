// Readiness and a synthetic sign-in against this workspace's local app, run by
// `scripts/dev-local.sh --smoke`. Refuses any origin but this workspace's.
import { setTimeout as pause } from "node:timers/promises";
import { workspace } from "./workspace.mts";

const origin = process.env.APP_ORIGIN;
const expected = `http://localhost:${workspace().ports.dev}`;
if (origin !== expected) {
  throw new Error(`Smoke check refuses ${origin ?? "an unset APP_ORIGIN"}; expected ${expected}`);
}
const commit = process.env.DEPLOYED_COMMIT;
if (!commit) {
  throw new Error("DEPLOYED_COMMIT is unset; run the smoke check through npm run agent:setup");
}

/** Waits up to a minute for /api/health to report this service at the source commit. */
async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(2000) });
      const body: unknown = await response.json();
      if (
        response.ok &&
        typeof body === "object" &&
        body !== null &&
        "service" in body &&
        body.service === "pikachubball" &&
        "commit" in body &&
        body.commit === commit
      ) {
        return;
      }
    } catch {
      // Not listening yet; the bounded loop reports failure below.
    }
    await pause(500);
  }
  throw new Error("Health check failed, or the app served a different commit");
}

/** Signs in as a seeded manager and reads /api/me with the session. */
async function checkSignIn(): Promise<void> {
  const login = await fetch(`${origin}/api/dev/login?user=a`, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  // The dev login answers 303 See Other, like the real sign-in callback.
  if (login.status !== 303 || !cookie) {
    throw new Error(`Synthetic sign-in failed with HTTP ${login.status}`);
  }
  const me = await fetch(`${origin}/api/me`, {
    headers: { cookie },
    signal: AbortSignal.timeout(5000),
  });
  if (!me.ok) {
    throw new Error(`The signed-in session failed with HTTP ${me.status}`);
  }
}

await waitForHealth();
await checkSignIn();
console.log("Health and synthetic sign-in passed for the source commit.");
