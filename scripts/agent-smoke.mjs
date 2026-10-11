// Readiness and synthetic sign-in only; refuses any non-loopback destination.
import { setTimeout } from "node:timers";
const origin = process.env.APP_ORIGIN;
if (origin !== "http://localhost:5072") throw new Error("Unexpected setup smoke origin");
const pause = () => new Promise((resolve) => setTimeout(resolve, 500));
let ready = false;
for (let attempt = 0; attempt < 120; attempt++) {
  try {
    const response = await fetch(`${origin}/api/health`, {
      signal: globalThis.AbortSignal.timeout(2000),
    });
    const body = await response.json();
    if (
      response.ok &&
      body.service === "pikachubball" &&
      body.commit === process.env.VERCEL_GIT_COMMIT_SHA
    ) {
      ready = true;
      break;
    }
  } catch {
    /* Startup is bounded; failure below remains visible. */
  }
  await pause();
}
if (!ready) throw new Error("Setup health smoke failed or served a different commit");
const login = await fetch(`${origin}/api/dev/login?user=a`, {
  redirect: "manual",
  signal: globalThis.AbortSignal.timeout(5000),
});
const cookie = login.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
if (login.status !== 302 || !cookie) throw new Error("Synthetic sign-in failed");
const me = await fetch(`${origin}/api/me`, {
  headers: { cookie },
  signal: globalThis.AbortSignal.timeout(5000),
});
if (!me.ok) throw new Error("Synthetic authenticated session failed");
console.log("Health and seeded authentication passed for the source commit.");
