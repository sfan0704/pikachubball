// Records the Yahoo calls the app depends on, scrubbed, as test fixtures.
// Usage: npm run capture:yahoo [-- <league_key>]
// It reads YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET from the environment or
// .env.local, opens Yahoo's sign-in page, finds your NBA leagues, and records
// the newest one and, if there is one, a league from an earlier season. Nothing
// secret is written or logged, and nothing is written if a personal value
// survives scrubbing.
import {
  accessToken,
  fetchJson,
  LEAGUE_KEY,
  leaguesOf,
  USER_TEAMS_PATH,
  writeScrubbed,
} from "./yahoo-capture-client";

const OUTPUT_DIR = "tests/backend/fixtures/yahoo/captured";
const USER_LEAGUES_PATH = "/users;use_login=1/games;game_codes=nba/leagues";

interface Capture {
  file: string;
  path: string;
}

const gameOf = (leagueKey: string): number => Number(leagueKey.split(".")[0]);

/** The newest league and one from the season before it, by Yahoo game key. */
function pickLeagues(userTeams: unknown): string[] {
  const [newest, ...rest] = leaguesOf(userTeams);
  if (!newest) {
    throw new Error("Yahoo lists no NBA teams for this account");
  }
  const earlier = rest.find((league) => gameOf(league) < gameOf(newest));
  return earlier ? [newest, earlier] : [newest];
}

function leagueCaptures(leagueKey: string, label: string): Capture[] {
  return [
    { file: `${label}-league-season.json`, path: `/league/${leagueKey};out=settings,standings` },
    {
      file: `${label}-league-current-week.json`,
      path: `/league/${leagueKey};out=settings,scoreboard`,
    },
    {
      file: `${label}-league-week-1.json`,
      path: `/league/${leagueKey};out=settings/scoreboard;week=1`,
    },
  ];
}

async function record(
  token: string,
  chosenLeague: string | undefined
): Promise<Map<string, unknown>> {
  const userTeams = await fetchJson(USER_TEAMS_PATH, token);
  const leagues = chosenLeague ? [chosenLeague] : pickLeagues(userTeams);
  const files = new Map([
    ["user-teams.json", userTeams],
    ["user-leagues.json", await fetchJson(USER_LEAGUES_PATH, token)],
  ]);
  for (const [index, leagueKey] of leagues.entries()) {
    for (const capture of leagueCaptures(leagueKey, index === 0 ? "newest" : "earlier")) {
      files.set(capture.file, await fetchJson(capture.path, token));
    }
  }
  return files;
}

async function main(): Promise<void> {
  const [chosenLeague] = process.argv.slice(2);
  if (chosenLeague && !LEAGUE_KEY.test(chosenLeague)) {
    throw new Error("Pass a league key such as 466.l.12345, or nothing to pick one");
  }
  await writeScrubbed(OUTPUT_DIR, await record(await accessToken(), chosenLeague));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
