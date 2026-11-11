import { readFileSync } from "node:fs";
import type { YahooRequester } from "../../server/fantasy/league-resources";
import { decodeYahooStrings } from "../../server/fantasy/yahoo/yahoo-text";

const RECORDINGS = "tests/backend/fixtures/yahoo";

/** A Yahoo stand-in that serves scrubbed recordings and remembers every path it was asked for. */
export interface RecordedYahoo extends YahooRequester {
  /** Every path requested, in order, one entry per call. */
  readonly calls: string[];
}

/** A recorded Yahoo body, read from `tests/backend/fixtures/yahoo/{name}.json`. */
export function yahooRecording(name: string): unknown {
  return JSON.parse(readFileSync(`${RECORDINGS}/${name}.json`, "utf8"));
}

/**
 * Serves each path from its recording (a name under the Yahoo fixtures, or a
 * body) with Yahoo's text decoded as the transport does, and counts the calls
 * so a test can hold a dataset to its budget. A path with no recording fails
 * the test rather than reaching any network.
 */
export function replayYahoo(recordings: Readonly<Record<string, string | object>>): RecordedYahoo {
  const calls: string[] = [];
  return {
    calls,
    async get(path: string): Promise<unknown> {
      calls.push(path);
      const recording = recordings[path];
      if (recording === undefined) {
        throw new Error(`No Yahoo recording for ${path}`);
      }
      const body = typeof recording === "string" ? yahooRecording(recording) : recording;
      return decodeYahooStrings(JSON.parse(JSON.stringify(body)));
    },
  };
}
