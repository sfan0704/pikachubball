import { describe, expect, it } from "vitest";
import { measured, missing, missingLine } from "../../../../shared/domain";
import {
  yahooCountValue,
  yahooDateLine,
  yahooMinutesValue,
  yahooShotValue,
} from "../../../../server/fantasy/yahoo/stat-value-parsers";

/** Yahoo's `stats` list for one date, in the order Yahoo sends it. */
function stats(values: Record<string, unknown>) {
  return Object.entries(values).map(([stat_id, value]) => ({ stat: { stat_id, value } }));
}

const PLAYED = {
  "9004003": "7/15",
  "5": ".467",
  "9007006": "4/5",
  "8": ".800",
  "10": "2",
  "12": "20",
  "15": "6",
  "16": "3",
  "17": "1",
  "18": "0",
  "19": "2",
};

describe("Yahoo stat value parsers", () => {
  it.each([
    ["-", missing("noGame")],
    ["", missing("notYetPlayed")],
    ["12", measured(12)],
    [0, measured(0)],
  ])("reads the count %j", (raw, expected) => {
    expect(yahooCountValue.parse(raw)).toEqual(expected);
  });

  it.each([
    ["-", missing("noGame")],
    ["-/-", missing("noGame")],
    ["", missing("notYetPlayed")],
    ["7/15", measured({ makes: 7, attempts: 15 })],
    ["0/0", measured({ makes: 0, attempts: 0 })],
  ])("reads the shots %j", (raw, expected) => {
    expect(yahooShotValue.parse(raw)).toEqual(expected);
  });

  it.each([
    ["-", missing("noGame")],
    ["", missing("notYetPlayed")],
    ["34", measured(34)],
    [34, measured(34)],
    ["31:30", measured(31.5)],
    ["0:00", measured(0)],
  ])("reads the minutes %j", (raw, expected) => {
    expect(yahooMinutesValue.parse(raw)).toEqual(expected);
  });

  it.each([["1.5"], ["-3"], ["INF"], [null], [undefined], ["n/a"]])(
    "rejects the count %j rather than defaulting it",
    (raw) => {
      expect(yahooCountValue.safeParse(raw).success).toBe(false);
    }
  );

  it.each([["8/5"], ["7-15"], ["/"], [7], [null]])("rejects the shots %j", (raw) => {
    expect(yahooShotValue.safeParse(raw).success).toBe(false);
  });

  it.each([["31:60"], ["31.5"], ["DNP"], [null]])("rejects the minutes %j", (raw) => {
    expect(yahooMinutesValue.safeParse(raw).success).toBe(false);
  });
});

describe("Yahoo date line", () => {
  it("reads a played line and ignores the percentages", () => {
    expect(yahooDateLine.parse(stats(PLAYED))).toEqual({
      fg: measured({ makes: 7, attempts: 15 }),
      ft: measured({ makes: 4, attempts: 5 }),
      tpm: measured(2),
      pts: measured(20),
      reb: measured(6),
      ast: measured(3),
      stl: measured(1),
      blk: measured(0),
      to: measured(2),
    });
  });

  it("reads a date without a team game as no game", () => {
    const line = stats({
      "9004003": "-/-",
      "5": "-",
      "9007006": "-/-",
      "8": "-",
      "10": "-",
      "12": "-",
      "15": "-",
      "16": "-",
      "17": "-",
      "18": "-",
      "19": "-",
    });

    expect(yahooDateLine.parse(line)).toEqual(missingLine("noGame"));
  });

  it("reads a game still to come as not yet played", () => {
    const line = stats(Object.fromEntries(Object.keys(PLAYED).map((id) => [id, ""])));

    expect(yahooDateLine.parse(line)).toEqual(missingLine("notYetPlayed"));
  });

  it("reads zeros and 0/0 on a team game day as did not play", () => {
    const line = stats({
      ...Object.fromEntries(Object.keys(PLAYED).map((id) => [id, "0"])),
      "9004003": "0/0",
      "9007006": "0/0",
      "5": "-",
      "8": "-",
    });

    expect(yahooDateLine.parse(line)).toEqual(missingLine("didNotPlay"));
  });

  it("reads GP 0 as did not play", () => {
    expect(yahooDateLine.parse(stats({ ...PLAYED, "0": "0" }))).toEqual(missingLine("didNotPlay"));
  });

  it("keeps a played line with no shots but other stats", () => {
    const line = yahooDateLine.parse(
      stats({ ...PLAYED, "9004003": "0/0", "9007006": "0/0", "12": "0", "10": "0" })
    );

    expect(line.reb).toEqual(measured(6));
    expect(line.fg).toEqual(measured({ makes: 0, attempts: 0 }));
  });

  it("fails when a category is absent instead of treating it as zero", () => {
    const { "15": _rebounds, ...withoutRebounds } = PLAYED;

    expect(yahooDateLine.safeParse(stats(withoutRebounds)).success).toBe(false);
  });
});
