import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nbaStatMakeup } from "../../../../server/fantasy/yahoo/nba-stat-makeup";

interface RecordedStat {
  stat_id: number;
  display_name: string;
  is_composite_stat?: number;
  base_stats?: { base_stat: { stat_id: string } }[];
}

/** Yahoo's NBA stat list, as recorded and scrubbed in FAN-147. */
const recorded: RecordedStat[] = JSON.parse(
  readFileSync("tests/backend/fixtures/yahoo/stat-categories/nba-stat-categories.json", "utf8")
).fantasy_content.game[1].stat_categories.stats.map((entry: { stat: RecordedStat }) => entry.stat);

describe("the make-up of Yahoo's NBA stats", () => {
  it("builds every stat Yahoo marks composite as a ratio of its two base stats", () => {
    const composite = recorded.filter((stat) => stat.is_composite_stat === 1);
    expect(composite.map((stat) => stat.display_name)).toEqual(["FG%", "FT%", "3PT%", "A/T"]);
    for (const stat of composite) {
      const makeup = nbaStatMakeup(String(stat.stat_id));
      const bases = (stat.base_stats ?? []).map((base) => base.base_stat.stat_id);
      expect(makeup.kind).toBe("ratio");
      if (makeup.kind === "ratio") {
        expect([makeup.topStatId, makeup.bottomStatId].sort()).toEqual([...bases].sort());
      }
    }
  });

  it("puts makes and assists on top", () => {
    expect(nbaStatMakeup("5")).toEqual({ kind: "ratio", topStatId: "4", bottomStatId: "3" });
    expect(nbaStatMakeup("20")).toEqual({ kind: "ratio", topStatId: "16", bottomStatId: "19" });
  });

  it("counts every other listed stat except minutes per game, an average", () => {
    const plain = recorded.filter((stat) => stat.is_composite_stat !== 1);
    for (const stat of plain) {
      expect(nbaStatMakeup(String(stat.stat_id)).kind).toBe(
        stat.display_name === "MPG" ? "unavailable" : "counting"
      );
    }
  });

  it("marks a stat Yahoo doesn't list as unavailable", () => {
    expect(nbaStatMakeup("1001")).toEqual({ kind: "unavailable" });
  });
});
