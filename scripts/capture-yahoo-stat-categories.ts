// Records Yahoo's official NBA stat list, scrubbed, so the league-categories work (FAN-144,
// FAN-145) can name every stat id a league or player stat line may carry, see each stat's
// sort order, and see whether Yahoo says how a ratio is built (FAN-147).
// Usage: npm run capture:yahoo-stat-categories
// Sign-in works as in capture-yahoo.ts. The one call is a read-only GET for the current
// NBA game; a stat list holds no personal details, but it passes the usual leak check.
import { accessToken, probe, writeScrubbed } from "./yahoo-capture-client";

const OUTPUT_DIR = "tests/backend/fixtures/yahoo/stat-categories";
const STAT_CATEGORIES_PATH = "/game/nba/stat_categories";

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error("This capture takes no arguments");
  }
  const { ok, status, body } = await probe(STAT_CATEGORIES_PATH, await accessToken());
  console.log(`GET ${STAT_CATEGORIES_PATH} -> ${status}`);
  if (!ok) {
    throw new Error(`Yahoo answered ${status}; nothing was written`);
  }
  await writeScrubbed(OUTPUT_DIR, new Map([["nba-stat-categories.json", body]]));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
