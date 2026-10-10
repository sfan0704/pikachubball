import { describe, expect, it } from "vitest";
import http from "node:http";
import { fixedClock } from "../../../support/clock";

describe("network guard", () => {
  it("fails a fetch to the real network", async () => {
    await expect(
      fetch("https://fantasysports.yahooapis.com/fantasy/v2/game/nba")
    ).rejects.toThrow();
  });

  it("lets loopback requests through to in-process servers", async () => {
    const server = http.createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(await response.text()).toBe("ok");
    } finally {
      server.close();
    }
  });
});

describe("fixedClock", () => {
  it("only moves when the test moves it", () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    expect(clock.now()).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    clock.advance(1_000);
    expect(clock.now()).toBe(Date.parse("2026-01-01T00:00:01.000Z"));
    clock.set("2026-02-01T00:00:00.000Z");
    expect(clock.now()).toBe(Date.parse("2026-02-01T00:00:00.000Z"));
  });

  it("rejects an invalid start time", () => {
    expect(() => fixedClock("not a time")).toThrow("invalid ISO time");
  });
});
