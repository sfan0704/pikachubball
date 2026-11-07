// Sign-in, read-only fetching and scrubbed writing shared by the Yahoo capture
// scripts. Nothing secret is written or logged, and nothing is written if a
// personal value survives scrubbing.
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { YahooScrubber } from "../server/dev/scrub-yahoo";

const AUTH_URL = "https://api.login.yahoo.com/oauth2";
const BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2";

/** The signed-in user's NBA teams, which name the leagues they play in. */
export const USER_TEAMS_PATH = "/users;use_login=1/games;game_codes=nba/teams";

/** A league key such as 466.l.12345. */
export const LEAGUE_KEY = /^\d+\.l\.\d+$/;

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

/** A Yahoo access token: YAHOO_ACCESS_TOKEN if set, otherwise a fresh sign-in. */
export async function accessToken(): Promise<string> {
  if (process.env.YAHOO_ACCESS_TOKEN) {
    return process.env.YAHOO_ACCESS_TOKEN;
  }
  const app = credentials();
  if (!app) {
    throw new Error("Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET, here or in .env.local");
  }
  return signIn(app.clientId, app.clientSecret);
}

/** The outcome of one read-only call: Yahoo's status and body, whether or not it refused. */
export interface Probe {
  ok: boolean;
  status: number;
  body: unknown;
}

/** GETs one Fantasy API path as JSON, reporting a refusal instead of throwing. */
export async function probe(path: string, token: string): Promise<Probe> {
  const response = await fetch(`${BASE_URL}${path}?format=json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: parsedOrText(text) };
}

// A refusal can come back as XML or HTML even when JSON was asked for; that text is the evidence.
function parsedOrText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** GETs one Fantasy API path as JSON, failing the capture if Yahoo refuses it. */
export async function fetchJson(path: string, token: string): Promise<unknown> {
  const result = await probe(path, token);
  if (!result.ok) {
    throw new Error(`Yahoo answered ${result.status} for ${path}`);
  }
  return result.body;
}

/** The league keys the user has teams in, newest game first. */
export function leaguesOf(userTeams: unknown): string[] {
  const keys = [...JSON.stringify(userTeams).matchAll(/"team_key":"(\d+)\.l\.(\d+)\.t\.\d+"/g)]
    .map(([, game, league]) => ({ game: Number(game), key: `${game}.l.${league}` }))
    .sort((a, b) => b.game - a.game)
    .map((league) => league.key);
  return [...new Set(keys)];
}

/**
 * Scrubs every response with one set of placeholders and replaces the output
 * folder with them. Writes nothing if a removed personal value still appears.
 */
export async function writeScrubbed(outputDir: string, files: Map<string, unknown>): Promise<void> {
  const scrubber = new YahooScrubber();
  const texts = new Map(
    [...files].map(([file, raw]) => [file, `${JSON.stringify(scrubber.scrub(raw), null, 2)}\n`])
  );
  const leaks = scrubber.leaksIn([...texts.values()].join("\n"));
  if (leaks.length > 0) {
    throw new Error(`${leaks.length} personal values survived scrubbing; nothing was written`);
  }
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  for (const [file, text] of texts) {
    await writeFile(join(outputDir, file), text);
    console.log(`recorded ${join(outputDir, file)}`);
  }
}
