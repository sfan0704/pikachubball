/** The synthetic managers the local seed creates. They exist only in the throwaway local stack. */
export interface SeedUser {
  readonly key: "a" | "b";
  readonly email: string;
  readonly password: string;
  readonly yahooGuid: string;
  readonly displayName: string;
  /** Their team in the recorded league. */
  readonly teamKey: string;
}

export const SEED_LEAGUE_KEY = "466.l.100000";

export const SEED_USERS: readonly SeedUser[] = [
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
