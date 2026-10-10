// Records the Yahoo calls the app depends on, scrubbed, as test fixtures.
// Usage: npm run capture:yahoo -- <league_key> [<week>]
// with YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET set (it then asks you to sign in
// to Yahoo and paste the code), or YAHOO_ACCESS_TOKEN set. Nothing secret is
// written or logged.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { scrubYahooResponse } from "../server/dev/scrub-yahoo";

const AUTH_URL = "https://api.login.yahoo.com/oauth2";
const BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2";
const OUTPUT_DIR = "tests/backend/fixtures/yahoo/captured";

interface Capture {
  file: string;
  path: string;
}

function capturesFor(leagueKey: string, week: number): Capture[] {
  return [
    { file: "user-teams.json", path: "/users;use_login=1/games;game_codes=nba/teams" },
    { file: "league-season.json", path: `/league/${leagueKey};out=settings,standings` },
    { file: "league-current-week.json", path: `/league/${leagueKey};out=settings,scoreboard` },
    {
      file: `league-week-${week}.json`,
      path: `/league/${leagueKey};out=settings/scoreboard;week=${week}`,
    },
  ];
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

/** Yahoo's out-of-band sign-in: the user approves in a browser and pastes the code here. */
async function signIn(clientId: string, clientSecret: string): Promise<string> {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "oob",
    response_type: "code",
  });
  console.log(`Open this link, approve, and paste the code:\n${AUTH_URL}/request_auth?${query}`);
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
  const { YAHOO_ACCESS_TOKEN, YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET } = process.env;
  if (YAHOO_ACCESS_TOKEN) {
    return YAHOO_ACCESS_TOKEN;
  }
  if (YAHOO_CLIENT_ID && YAHOO_CLIENT_SECRET) {
    return signIn(YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET);
  }
  throw new Error("Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET, or YAHOO_ACCESS_TOKEN");
}

async function main(): Promise<void> {
  const [leagueKey, weekArg] = process.argv.slice(2);
  if (!leagueKey || !/^\d+\.l\.\d+$/.test(leagueKey)) {
    throw new Error("Pass a league key such as 466.l.12345");
  }
  const token = await accessToken();
  const week = Number(weekArg ?? 1);
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const capture of capturesFor(leagueKey, week)) {
    const scrubbed = scrubYahooResponse(await fetchJson(capture.path, token));
    await writeFile(join(OUTPUT_DIR, capture.file), `${JSON.stringify(scrubbed, null, 2)}\n`);
    console.log(`recorded ${capture.file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
