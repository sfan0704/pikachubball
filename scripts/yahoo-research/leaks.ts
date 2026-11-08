// The leak check for the research capture, which is shared privately and holds
// hundreds of public NBA names.
import type { YahooScrubber } from "../../server/dev/scrub-yahoo";

// Public NBA names: a removed team or manager name can also be a player's first or
// last name, or part of an NBA team's name, without anything personal leaking.
const PUBLIC_NAME_KEYS = new Set([
  "full",
  "first",
  "last",
  "ascii_first",
  "ascii_last",
  "editorial_team_full_name",
  "editorial_team_abbr",
]);

interface LeakLocation {
  file: string;
  key: string;
  value: string;
}

/** Every field in the JSON files whose whole value is one of the removed values. */
function leakLocations(texts: Map<string, string>, removed: Set<string>): LeakLocation[] {
  const found: LeakLocation[] = [];
  for (const [file, text] of texts) {
    if (!file.endsWith(".json")) {
      continue;
    }
    JSON.parse(text, (key: string, value: unknown) => {
      if (typeof value === "string" && removed.has(value)) {
        found.push({ file, key, value });
      }
      return value;
    });
  }
  return found;
}

/** Each file with the keys a leak sits under, so a failure can be traced without printing values. */
function describe(locations: LeakLocation[]): string {
  const byFile = new Map<string, Set<string>>();
  for (const { file, key } of locations) {
    byFile.set(file, (byFile.get(file) ?? new Set()).add(key));
  }
  return [...byFile].map(([file, keys]) => `${file}: ${[...keys].join(", ")}`).join("\n  ");
}

/**
 * Fails when a removed personal value survives as a whole field the scrubber should
 * have replaced.
 */
// The research folder is shared privately, never committed, and holds hundreds of NBA
// names, so only a removed value left as a whole, non-public field fails; the rest are counted.
export function checkLeaks(scrubber: YahooScrubber, texts: Map<string, string>): void {
  const all = [...texts.values()].join("\n");
  const locations = leakLocations(texts, new Set(scrubber.fieldLeaksIn(all)));
  const leaks = locations.filter((location) => !PUBLIC_NAME_KEYS.has(location.key));
  if (leaks.length > 0) {
    const count = new Set(leaks.map((leak) => leak.value)).size;
    throw new Error(
      `${count} personal values survived scrubbing; nothing was written. Found under:\n  ${describe(leaks)}`
    );
  }
  const alsoPublic = scrubber.leaksIn(all).length;
  if (alsoPublic > 0) {
    console.log(`${alsoPublic} removed names also appear in public NBA names or other text`);
  }
}
