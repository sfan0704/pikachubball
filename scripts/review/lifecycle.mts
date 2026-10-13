// The checks and record behind `npm run review:*` (scripts/review.mts), kept
// free of processes and files so tests can drive them directly.

/** What `review:start` writes to .workspace/review.json and `review:status` prints. */
export interface ReviewRecord {
  readonly url: string;
  readonly commit: string;
  readonly workspace: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  /** The process group running the stand-in and the app; only this group is ever stopped. */
  readonly pid: number;
}

const LOOPBACK = /^(https?|postgres(ql)?):\/\/([^@/]*@)?(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/;

// A review environment is synthetic. Any of these set to a hosted value means
// the worker is carrying real configuration, so start refuses instead of
// quietly overriding it.
const HOSTED_TARGETS = [
  "SUPABASE_URL",
  "SUPABASE_DB_URL",
  "YAHOO_API_BASE_URL",
  "YAHOO_OAUTH_BASE_URL",
  "APP_ORIGIN",
] as const;
const REAL_CREDENTIALS = [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
  "YAHOO_CLIENT_ID",
  "YAHOO_CLIENT_SECRET",
  "ENCRYPTION_KEY",
  "ENCRYPTION_KEY_PREVIOUS",
] as const;

/** Names (never values) of hosted targets or real credentials present in the environment. */
export function hostedConfiguration(env: Readonly<Record<string, string | undefined>>): string[] {
  const problems: string[] = [];
  for (const name of HOSTED_TARGETS) {
    const value = env[name];
    if (value && !LOOPBACK.test(value)) problems.push(`${name} points at a hosted address`);
  }
  for (const name of REAL_CREDENTIALS) {
    if (env[name]) problems.push(`${name} is set`);
  }
  if (env.NODE_ENV === "production") problems.push("NODE_ENV is production");
  return problems;
}

/** The record for a review that has just answered at `url` for `commit`. */
export function newRecord(input: {
  url: string;
  commit: string;
  workspace: string;
  pid: number;
  now: number;
  lifetimeMinutes: number;
}): ReviewRecord {
  return {
    url: input.url,
    commit: input.commit,
    workspace: input.workspace,
    pid: input.pid,
    startedAt: new Date(input.now).toISOString(),
    expiresAt: new Date(input.now + input.lifetimeMinutes * 60_000).toISOString(),
  };
}

/** Whether a review has outlived its lifetime. */
export function expired(record: ReviewRecord, now: number): boolean {
  return now >= Date.parse(record.expiresAt);
}

/** Reads a record, refusing anything that isn't one (a hand-edited or foreign file). */
export function parseRecord(text: string): ReviewRecord {
  const value: unknown = JSON.parse(text);
  const fields = ["url", "commit", "workspace", "startedAt", "expiresAt"] as const;
  if (
    typeof value !== "object" ||
    value === null ||
    !fields.every((field) => typeof (value as Record<string, unknown>)[field] === "string") ||
    !Number.isInteger((value as Record<string, unknown>).pid)
  ) {
    throw new Error(
      "The review record is not one this tool wrote; remove .workspace/review.json by hand"
    );
  }
  return value as ReviewRecord;
}

/** Lifetime in minutes from REVIEW_LIFETIME_MINUTES: 2 hours by default, at most 12. */
export function lifetimeMinutes(env: Readonly<Record<string, string | undefined>>): number {
  const raw = env.REVIEW_LIFETIME_MINUTES;
  if (raw === undefined) return 120;
  const minutes = Number(raw);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
    throw new Error("REVIEW_LIFETIME_MINUTES must be a whole number of minutes from 1 to 720");
  }
  return minutes;
}
