// Records rostered players' Yahoo game logs (FAN-92) in rounds a few minutes apart, into
// yahoo-research/FAN-92-game-log/. Run it while NBA games are live, and once on a Monday.
// Usage: npm run capture:yahoo-game-log [-- <league_key>] [-- --rounds=2] [-- --minutes=2]
// Only read-only GET calls. Nothing is written if a removed personal value survives scrubbing.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { YahooScrubber } from "../server/dev/scrub-yahoo";
import { accessToken, fetchJson, LEAGUE_KEY, probe, USER_TEAMS_PATH } from "./yahoo-capture-client";
import { ownTeam } from "./yahoo-research/discover";
import { gameLogCalls, gameLogReadme } from "./yahoo-research/game-log";
import { checkLeaks } from "./yahoo-research/leaks";

const OUTPUT_DIR = join("yahoo-research", "FAN-92-game-log");
const NUMBER_FLAG = /^--(rounds|minutes)=(\d+)$/;

interface Options {
  league?: string;
  rounds: number;
  minutes: number;
}

function options(args: string[]): Options {
  const chosen: Options = { rounds: 2, minutes: 2 };
  for (const arg of args) {
    const flag = NUMBER_FLAG.exec(arg);
    if (LEAGUE_KEY.test(arg)) {
      chosen.league = arg;
    } else if (flag?.[1] === "rounds" || flag?.[1] === "minutes") {
      chosen[flag[1]] = Number(flag[2]);
    } else {
      throw new Error("Pass a league key such as 466.l.12345, --rounds=<n> or --minutes=<n>");
    }
  }
  return chosen;
}

async function main(): Promise<void> {
  const chosen = options(process.argv.slice(2));
  const token = await accessToken();
  const { leagueKey } = ownTeam(await fetchJson(USER_TEAMS_PATH, token), chosen.league);
  const scrubber = new YahooScrubber();
  const texts = new Map<string, string>();
  const rows: { file: string; path: string; status: number; at: string }[] = [];
  for (let round = 1; round <= chosen.rounds; round += 1) {
    if (round > 1) {
      console.log(`Waiting ${chosen.minutes} minutes before round ${round}`);
      await wait(chosen.minutes * 60_000);
    }
    for (const call of gameLogCalls(leagueKey, round)) {
      const at = new Date().toISOString();
      const { status, body } = await probe(call.path, token);
      console.log(`GET ${call.path} -> ${status}`);
      const response = scrubber.scrub(body);
      texts.set(
        call.file,
        `${JSON.stringify({ request: call.path, at, status, response }, null, 2)}\n`
      );
      rows.push({ ...call, status, at });
    }
  }
  checkLeaks(scrubber, texts);
  texts.set("README.md", gameLogReadme(leagueKey, rows));
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const [file, text] of texts) {
    await writeFile(join(OUTPUT_DIR, file), text);
  }
  console.log(
    `Wrote ${texts.size} files to ${OUTPUT_DIR}/. Zip the folder and attach it to FAN-92.`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
