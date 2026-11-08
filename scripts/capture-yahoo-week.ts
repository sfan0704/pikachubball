// Records one finished scoring week of your matchup, scrubbed, so the daily
// stats research (FAN-91) can check dated rosters, counted contributions and
// games left against Yahoo's official totals without calling Yahoo again.
// Usage: npm run capture:yahoo-week [-- <league_key> [week]]
// Defaults: your newest NBA league and the last finished week. Sign-in works as
// in capture-yahoo.ts. Every call is a read-only GET; a call Yahoo refuses is
// listed in probes.json with its status instead of stopping the capture.
// Output goes to yahoo-research/week-<n>/, which is gitignored like the research
// capture: it is shared privately, and it uses the same leak check, which lets
// public NBA names through (a team name can also be a player's name).
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { YahooScrubber } from "../server/dev/scrub-yahoo";
import { accessToken, LEAGUE_KEY } from "./yahoo-capture-client";
import { checkLeaks } from "./yahoo-research/leaks";
import { recordWeek } from "./yahoo-research/week";

/** Scrubs every file with one set of placeholders and fails before writing if a personal value is left. */
function scrubbed(files: Map<string, unknown>): Map<string, string> {
  const scrubber = new YahooScrubber();
  const texts = new Map(
    [...files].map(([file, raw]) => [file, `${JSON.stringify(scrubber.scrub(raw), null, 2)}\n`])
  );
  checkLeaks(scrubber, texts);
  return texts;
}

async function main(): Promise<void> {
  const [chosenLeague, chosenWeek] = process.argv.slice(2);
  if (chosenLeague && !LEAGUE_KEY.test(chosenLeague)) {
    throw new Error("Pass a league key such as 466.l.12345, or nothing to pick one");
  }
  if (chosenWeek && !/^\d+$/.test(chosenWeek)) {
    throw new Error("Pass the week as a number, such as 2");
  }
  const files = await recordWeek(
    await accessToken(),
    chosenLeague,
    chosenWeek ? Number(chosenWeek) : undefined
  );
  const texts = scrubbed(files);
  const probes = files.get("probes.json");
  const week = typeof probes === "object" && probes !== null && "week" in probes ? probes.week : "";
  const outputDir = join("yahoo-research", `week-${String(week)}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  for (const [file, text] of texts) {
    await writeFile(join(outputDir, file), text);
  }
  console.log(
    `Wrote ${texts.size} files to ${outputDir}/. Zip it and attach it in the project chat.`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
