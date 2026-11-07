// Records one finished scoring week of your matchup, scrubbed, so the daily
// stats research (FAN-91) can check dated rosters, counted contributions and
// games left against Yahoo's official totals without calling Yahoo again.
// Usage: npm run capture:yahoo-week [-- <league_key> [week]]
// Defaults: your newest NBA league and the last finished week. Sign-in works as
// in capture-yahoo.ts. Every call is a read-only GET; a call Yahoo refuses is
// listed in probes.json with its status instead of stopping the capture.
import { accessToken, LEAGUE_KEY, writeScrubbed } from "./yahoo-capture-client";
import { recordWeek } from "./yahoo-research/week";

const OUTPUT_DIR = "tests/backend/fixtures/yahoo/captured-week";

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
  await writeScrubbed(OUTPUT_DIR, files);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
