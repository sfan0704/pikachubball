// Simulates 14 managers using the app at the same moment, against the local
// stack and the Yahoo stand-in (never real Yahoo): `npm run load`.
// Each phase starts with every user at once. It reports how long league views
// take against the 2-second target and how many Yahoo calls each phase made.
import { SEED_LEAGUE_KEY, seedUsers, type SeedUser } from "../server/dev/seed-users";

const BASE = process.env.LOAD_BASE_URL ?? "http://localhost:5071";
const STANDIN = process.env.LOAD_STANDIN_URL ?? "http://127.0.0.1:5097";
const USERS = 14;
const TARGET_MS = 2000;

if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(BASE) || !/^http:\/\/127\.0\.0\.1:/.test(STANDIN)) {
  throw new Error("The load test only runs against a local app and the local Yahoo stand-in");
}

class Session {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly user: SeedUser) {}

  async signIn(): Promise<void> {
    const response = await fetch(`${BASE}/api/dev/login?user=${this.user.key}`, {
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, ...value] = pair.split("=");
      this.cookies.set(name, value.join("="));
    }
    if (response.status !== 303 || this.cookies.size === 0) {
      throw new Error(`Sign-in failed for ${this.user.email}: ${response.status}`);
    }
  }

  /** A GET as the signed-in user; returns how long it took. */
  async get(path: string): Promise<number> {
    const started = performance.now();
    const response = await fetch(`${BASE}${path}`, {
      headers: { Cookie: [...this.cookies].map(([n, v]) => `${n}=${v}`).join("; ") },
    });
    await response.arrayBuffer();
    if (!response.ok) {
      throw new Error(`${path} answered ${response.status} for ${this.user.email}`);
    }
    return performance.now() - started;
  }
}

async function yahooCalls(): Promise<number> {
  const state = (await (await fetch(`${STANDIN}/__state`)).json()) as { requests: string[] };
  return state.requests.length;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

interface PhaseResult {
  readonly name: string;
  readonly timings: number[];
  readonly calls: number;
  readonly expectedCalls: number;
  readonly isView: boolean;
}

/** Runs one step for every user at once and counts the Yahoo calls it caused. */
async function phase(
  name: string,
  sessions: Session[],
  expectedCalls: number,
  isView: boolean,
  step: (session: Session) => Promise<number>
): Promise<PhaseResult> {
  const before = await yahooCalls();
  const timings = await Promise.all(sessions.map(step));
  return { name, timings, calls: (await yahooCalls()) - before, expectedCalls, isView };
}

const table = (scope: string) => `/api/leagues/${SEED_LEAGUE_KEY}/${scope}`;

async function main(): Promise<void> {
  await fetch(`${STANDIN}/__scenario`, {
    method: "POST",
    body: JSON.stringify({ scenario: "ok" }),
  });
  const sessions = seedUsers(USERS).map((user) => new Session(user));
  await Promise.all(sessions.map((session) => session.signIn()));

  const results: PhaseResult[] = [];
  // Opening the league view: who I am and my leagues, then the table of the starting scope.
  results.push(
    await phase("open the league view", sessions, USERS, true, async (session) => {
      const started = performance.now();
      await Promise.all([session.get("/api/me"), session.get("/api/leagues")]);
      await session.get(table("current"));
      return performance.now() - started;
    })
  );
  for (const scope of ["season", "1", "2"]) {
    results.push(
      await phase(`switch to a new scope (${scope})`, sessions, USERS, true, (session) =>
        session.get(table(scope))
      )
    );
  }
  // Going back to a scope already loaded, or comparing teams, needs no request: the
  // client keeps the table and computes comparisons itself. Zero calls is what is measured.
  results.push(await phase("repeat views and comparisons", sessions, 0, false, async () => 0));
  results.push(
    await phase("open a roster", sessions, USERS, false, (session) =>
      session.get(`/api/leagues/${SEED_LEAGUE_KEY}/teams/${SEED_LEAGUE_KEY}.t.3/roster`)
    )
  );

  let failed = false;
  console.log(`${USERS} users at once; target ${TARGET_MS} ms per league view\n`);
  console.log(
    "phase                                  p50 ms   p95 ms   max ms   yahoo calls (expected)"
  );
  for (const result of results) {
    const sorted = [...result.timings].sort((a, b) => a - b);
    const callsOk = result.calls === result.expectedCalls;
    const timeOk = !result.isView || percentile(sorted, 95) <= TARGET_MS;
    failed ||= !callsOk || !timeOk;
    console.log(
      `${result.name.padEnd(36)} ${percentile(sorted, 50).toFixed(0).padStart(7)} ${percentile(sorted, 95).toFixed(0).padStart(8)} ${sorted[sorted.length - 1].toFixed(0).padStart(8)}   ${String(result.calls).padStart(3)} (${result.expectedCalls}) ${callsOk && timeOk ? "ok" : "FAIL"}`
    );
  }
  console.log(failed ? "\nFAILED" : "\nPassed");
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
