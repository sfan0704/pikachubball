// Records the two daily-stats calls the retrieval plan had not tried (FAN-102), scrubbed,
// as fixtures for the parsers: game logs for 25 players by key (D3) and a trading team's
// adds, drops and trades (D7), plus the signed-in team's. Run it while NBA games are live,
// so a live game is in the D3 recording.
// Usage: npm run capture:yahoo-live-calls [-- <league_key>]
// Only read-only GET calls. Calls Yahoo rejects are recorded with their status, not fatal.
// Nothing is written if a removed personal value survives scrubbing.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { YahooScrubber } from "../server/dev/scrub-yahoo";
import { accessToken, fetchJson, LEAGUE_KEY, probe, USER_TEAMS_PATH } from "./yahoo-capture-client";
import { ownTeam } from "./yahoo-research/discover";
import { checkLeaks } from "./yahoo-research/leaks";
import {
  gameLogsPath,
  gameLogsSummary,
  liveCallsReadme,
  multiKeyPlayers,
  teamTransactionsPath,
  tradingTeam,
  transactionsSummary,
  type LiveCallRow,
} from "./yahoo-research/live-calls";

const OUTPUT_DIR = "tests/backend/fixtures/yahoo/daily-stats";

interface Recording extends LiveCallRow {
  body: unknown;
}

async function record(
  label: string,
  file: string,
  path: string,
  token: string,
  summarise: (body: unknown) => string
): Promise<Recording> {
  const at = new Date().toISOString();
  const { status, body } = await probe(path, token);
  const summary = status === 200 ? summarise(body) : "Yahoo refused the call";
  console.log(`GET ${path} -> ${status}: ${summary}`);
  return { label, file, path, status, at, summary, body };
}

async function gameLogs(leagueKey: string, token: string): Promise<Recording> {
  // The tested status=T pages (D6) show whose game is live; those players go first.
  const pages = [];
  for (const start of [0, 25]) {
    pages.push(
      await fetchJson(
        `/league/${leagueKey}/players;status=T;start=${start};count=25;out=game_log`,
        token
      )
    );
  }
  const keys = multiKeyPlayers(pages);
  return record(
    "D3 game logs, 25 players by key",
    "d3-game-logs-by-key.json",
    gameLogsPath(leagueKey, keys),
    token,
    (body) => gameLogsSummary(keys, body)
  );
}

async function transactions(
  leagueKey: string,
  teamKey: string,
  token: string
): Promise<Recording[]> {
  const feed = await fetchJson(`/league/${leagueKey}/transactions;types=add,drop,trade`, token);
  const trader = tradingTeam(feed);
  if (!trader) {
    throw new Error("No team in this league has made a trade; D7 needs one");
  }
  const teams: [string, string, string][] = [
    ["D7 transactions, a team that traded", "d7-transactions-trading-team.json", trader],
    ["D7 transactions, the signed-in team", "d7-transactions-own-team.json", teamKey],
  ];
  const recorded: Recording[] = [];
  for (const [label, file, team] of teams) {
    recorded.push(
      await record(label, file, teamTransactionsPath(leagueKey, team), token, (body) =>
        transactionsSummary(team, body)
      )
    );
  }
  return recorded;
}

async function main(): Promise<void> {
  const [chosen, ...rest] = process.argv.slice(2);
  if (rest.length > 0 || (chosen && !LEAGUE_KEY.test(chosen))) {
    throw new Error("Pass a league key such as 466.l.12345, or nothing to use your newest league");
  }
  const token = await accessToken();
  const { leagueKey, teamKey } = ownTeam(await fetchJson(USER_TEAMS_PATH, token), chosen);
  const recordings = [
    await gameLogs(leagueKey, token),
    ...(await transactions(leagueKey, teamKey, token)),
  ];
  const scrubber = new YahooScrubber();
  const texts = new Map(
    recordings.map((r) => [r.file, `${JSON.stringify(scrubber.scrub(r.body), null, 2)}\n`])
  );
  checkLeaks(scrubber, texts);
  texts.set("README.md", liveCallsReadme(leagueKey, recordings));
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const [file, text] of texts) {
    await writeFile(join(OUTPUT_DIR, file), text);
  }
  console.log(`Wrote ${texts.size} files to ${OUTPUT_DIR}/. Commit them on the FAN-102 branch.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
