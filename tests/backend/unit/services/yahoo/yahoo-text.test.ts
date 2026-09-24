import { describe, expect, it } from "vitest";
import {
  decodeYahooStrings,
  decodeYahooText,
} from "../../../../../server/services/yahoo/yahoo-text";

describe("decodeYahooText", () => {
  it("decodes the numeric apostrophe Yahoo sends in team names", () => {
    expect(decodeYahooText("Ball don&#39;t lie")).toBe("Ball don't lie");
  });

  it("decodes hex and named entities", () => {
    expect(decodeYahooText("Tom &amp; Jerry &#x27;24 &quot;A&quot; &lt;3")).toBe(
      "Tom & Jerry '24 \"A\" <3",
    );
  });

  it("leaves CJK, emoji and plain names unchanged", () => {
    for (const name of ["皮卡丘打籃球 season 4", "JC醫🐲", "LeBron Durant", "A&B"]) {
      expect(decodeYahooText(name)).toBe(name);
    }
  });

  it("decodes exactly once", () => {
    expect(decodeYahooText("&amp;#39;")).toBe("&#39;");
  });

  it("leaves unknown or invalid entities as text", () => {
    expect(decodeYahooText("&bogus; &#0; &#xD800; &#1114112;")).toBe(
      "&bogus; &#0; &#xD800; &#1114112;",
    );
  });

  it("produces text, not markup", () => {
    expect(decodeYahooText("&lt;img src=x onerror=alert(1)&gt;")).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });
});

describe("decodeYahooStrings", () => {
  it("decodes nested string values and keeps keys and other types", () => {
    const input = {
      fantasy_content: {
        league: [
          { league_key: "466.l.1", name: "Friends &amp; Family", num_teams: 14 },
          { teams: { "0": { team: [[{ name: "Ball don&#39;t lie" }, { is_owned_by_current_login: 1 }]] } } },
        ],
        flag: true,
        empty: null,
      },
    };

    expect(decodeYahooStrings(input)).toEqual({
      fantasy_content: {
        league: [
          { league_key: "466.l.1", name: "Friends & Family", num_teams: 14 },
          { teams: { "0": { team: [[{ name: "Ball don't lie" }, { is_owned_by_current_login: 1 }]] } } },
        ],
        flag: true,
        empty: null,
      },
    });
    expect(input.fantasy_content.league[0]).toMatchObject({ name: "Friends &amp; Family" });
  });
});
