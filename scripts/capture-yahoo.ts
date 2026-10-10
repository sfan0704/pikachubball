// Records the Yahoo calls the app depends on, scrubbed, as test fixtures.
// Usage: npm run capture:yahoo [-- <league_key>]
// It reads YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET from the environment or
// .env.local, opens Yahoo's sign-in page, finds your NBA leagues, and records
// the newest one and, if there is one, a league from an earlier season. Nothing
// secret is written or logged, and nothing is written if a personal value
// survives scrubbing.
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { YahooScrubber } from "../server/dev/scrub-yahoo";

const AUTH_URL = "https://api.login.yahoo.com/oauth2";
const BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2";
const OUTPUT_DIR = "tests/backend/fixtures/yahoo/captured";
const USER_TEAMS_PATH = "/users;use_login=1/games;game_codes=nba/teams";
const LEAGUE_KEY = /^\d+\.l\.\d+$/;
const TEAM_KEY_IN_TEXT = /"team_key":"(\d+)\.l\.(\d+)\.t\.\d+"/g;

interface Capture {
  file: string;
  path: string;
}

function credentials(): { clientId: string; clientSecret: string } | undefined {
  config({ path: ".env.local", quiet: true });
  const { YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET } = process.env;
  return YAHOO_CLIENT_ID && YAHOO_CLIENT_SECRET
    ? { clientId: YAHOO_CLIENT_ID, clientSecret: YAHOO_CLIENT_SECRET }
    : undefined;
}

/** Yahoo's out-of-band sign-in: the user approves in a browser and pastes the code here. */
async function signIn(clientId: string, clientSecret: string): Promise<string> {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "oob",
    response_type: "code",
  });
  const link = `${AUTH_URL}/request_auth?${query}`;
  console.log(`Approve access in the browser, then paste the code Yahoo shows.\n${link}`);
  execFile("open", [link], () => undefined);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await prompt.question("Code: ")).trim();
  prompt.close();
  const response = await fetch(`${AUTH_URL}/get_token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", redirect_uri: "oob", code }),
  });
  const body: unknown = await response.json();
  if (!response.ok || typeof body !== "object" || body === null || !("access_token" in body)) {
    throw new Error(`Yahoo sign-in failed with ${response.status}`);
  }
  return String(body.access_token);
}

async function accessToken(): Promise<string> {
  if (process.env.YAHOO_ACCESS_TOKEN) {
    return process.env.YAHOO_ACCESS_TOKEN;
  }
  const app = credentials();
  if (!app) {
    throw new Error("Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET, here or in .env.local");
  }
  return signIn(app.clientId, app.clientSecret);
}

async function fetchJson(path: string, token: string): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}?format=json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Yahoo answered ${response.status} for ${path}`);
  }
  return response.json();
}

/** The newest league and one from the season before it, by Yahoo game key. */
function pickLeagues(userTeams: unknown): string[] {
  const leagues = [...JSON.stringify(userTeams).matchAll(TEAM_KEY_IN_TEXT)]
    .map(([, game, league]) => ({ game: Number(game), key: `${game}.l.${league}` }))
    .sort((a, b) => b.game - a.game);
  const newest = leagues[0];
  if (!newest) {
    throw new Error("Yahoo lists no NBA teams for this account");
  }
  const earlier = leagues.find((league) => league.game < newest.game);
  return earlier ? [newest.key, earlier.key] : [newest.key];
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
): Promise<Map<string, string>> {
  const scrubber = new YahooScrubber();
  const userTeams = await fetchJson(USER_TEAMS_PATH, token);
  const leagues = chosenLeague ? [chosenLeague] : pickLeagues(userTeams);
  const files = new Map([["user-teams.json", userTeams]]);
  for (const [index, leagueKey] of leagues.entries()) {
    for (const capture of leagueCaptures(leagueKey, index === 0 ? "newest" : "earlier")) {
      files.set(capture.file, await fetchJson(capture.path, token));
    }
  }
  const texts = new Map(
    [...files].map(([file, raw]) => [file, `${JSON.stringify(scrubber.scrub(raw), null, 2)}\n`])
  );
  const leaks = scrubber.leaksIn([...texts.values()].join("\n"));
  if (leaks.length > 0) {
    throw new Error(`${leaks.length} personal values survived scrubbing; nothing was written`);
  }
  return texts;
}

async function main(): Promise<void> {
  const [chosenLeague] = process.argv.slice(2);
  if (chosenLeague && !LEAGUE_KEY.test(chosenLeague)) {
    throw new Error("Pass a league key such as 466.l.12345, or nothing to pick one");
  }
  const texts = await record(await accessToken(), chosenLeague);
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const [file, text] of texts) {
    await writeFile(join(OUTPUT_DIR, file), text);
    console.log(`recorded ${join(OUTPUT_DIR, file)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
