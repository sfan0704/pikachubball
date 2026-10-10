import { describe, expect, it } from "vitest";
import { YahooScrubber } from "../../../../server/dev/scrub-yahoo";

const response = {
  fantasy_content: {
    team: [
      [
        { team_key: "466.l.1.t.2" },
        { name: "Real Team Name" },
        { url: "https://basketball.fantasysports.yahoo.com/nba/1/2" },
        {
          managers: [
            {
              manager: { manager_id: "2", nickname: "Real Person", guid: "ABC123", email: "a@b.c" },
            },
          ],
        },
      ],
    ],
    game: { name: "Basketball", code: "nba" },
  },
};

describe("YahooScrubber", () => {
  it("removes names, identifiers, emails and links", () => {
    const text = JSON.stringify(new YahooScrubber().scrub(response));

    for (const personal of [
      "Real Team Name",
      "Real Person",
      "ABC123",
      "a@b.c",
      "basketball.fantasysports",
    ]) {
      expect(text).not.toContain(personal);
    }
  });

  it("keeps the structure and the game's own name", () => {
    const scrubbed = new YahooScrubber().scrub(response) as typeof response;

    expect(scrubbed.fantasy_content.team[0]?.[0]).toEqual({ team_key: "466.l.1.t.2" });
    expect(scrubbed.fantasy_content.game.name).toBe("Basketball");
  });

  it("gives the same identifier the same placeholder", () => {
    const twice = new YahooScrubber().scrub({
      a: { guid: "X" },
      b: { guid: "X" },
      c: { guid: "Y" },
    }) as {
      a: { guid: string };
      b: { guid: string };
      c: { guid: string };
    };

    expect(twice.a.guid).toBe(twice.b.guid);
    expect(twice.a.guid).not.toBe(twice.c.guid);
  });

  it("finds a removed value that survived elsewhere in the text", () => {
    const scrubber = new YahooScrubber();
    const scrubbed = scrubber.scrub(response);

    expect(scrubber.leaksIn(JSON.stringify(scrubbed))).toEqual([]);
    expect(scrubber.leaksIn("week won by Real Team Name")).toEqual(["Real Team Name"]);
  });
});
