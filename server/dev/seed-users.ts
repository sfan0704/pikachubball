/** The synthetic managers the local seed creates. They exist only in the throwaway local stack. */
export interface SeedUser {
  /** "a", "b", then "u3" to "u14" for the load test. */
  readonly key: string;
  readonly email: string;
  readonly password: string;
  readonly yahooGuid: string;
  readonly displayName: string;
  /** Their team in the recorded league. */
  readonly teamKey: string;
}

export const SEED_LEAGUE_KEY = "466.l.100000";

/** The recorded league has 14 teams, so there can be 14 managers. */
export const MAX_SEED_USERS = 14;

const FIXED: readonly SeedUser[] = [
  {
    key: "a",
    email: "manager-a@example.test",
    password: "local-only-password-a",
    yahooGuid: "LOCALGUIDAAAAAAAAAAAAAAAAAA",
    displayName: "Manager A",
    teamKey: `${SEED_LEAGUE_KEY}.t.11`,
  },
  {
    key: "b",
    email: "manager-b@example.test",
    password: "local-only-password-b",
    yahooGuid: "LOCALGUIDBBBBBBBBBBBBBBBBBB",
    displayName: "Manager B",
    teamKey: `${SEED_LEAGUE_KEY}.t.3`,
  },
];

/** The teams the first two managers don't have, for the extra load-test managers. */
const SPARE_TEAMS = [1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14];

/** The first `count` seeded managers: two by default, up to one per team. */
export function seedUsers(count = FIXED.length): SeedUser[] {
  const total = Math.min(Math.max(count, FIXED.length), MAX_SEED_USERS);
  const extra = SPARE_TEAMS.slice(0, total - FIXED.length).map((team, index): SeedUser => {
    const n = index + 3;
    return {
      key: `u${n}`,
      email: `manager-u${n}@example.test`,
      password: `local-only-password-u${n}`,
      yahooGuid: `LOCALGUIDU${String(n).padStart(2, "0")}`.padEnd(27, "U"),
      displayName: `Manager ${n}`,
      teamKey: `${SEED_LEAGUE_KEY}.t.${team}`,
    };
  });
  return [...FIXED, ...extra];
}

/** One seeded manager by key, among all that can exist. */
export function seedUser(key: unknown): SeedUser | undefined {
  return seedUsers(MAX_SEED_USERS).find((candidate) => candidate.key === key);
}
