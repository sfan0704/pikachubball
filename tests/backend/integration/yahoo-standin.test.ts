import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { YahooFantasyDataSource } from "../../../server/fantasy/fantasy-data-source";
import { YahooLeagueResources } from "../../../server/fantasy/league-resources";
import { createYahooStandIn } from "../../../server/dev/yahoo-standin";
import { YahooApiClient } from "../../../server/fantasy/yahoo/yahoo-api-client";
import { getTeamRoster } from "../../../server/fantasy/yahoo/roster-service";
import {
  YahooRateLimitedError,
  YahooUnavailableError,
} from "../../../server/fantasy/yahoo/yahoo-request-policy";
import { refreshAccessToken } from "../../../server/fantasy/yahoo/yahoo-auth";
import type { YahooTokenStorage } from "../../../server/storage/yahoo-token-storage";

const LEAGUE = "466.l.100000";
let server: Server;
let origin: string;

beforeAll(async () => {
  server = createYahooStandIn({ fixturesDir: "tests/backend/fixtures/yahoo" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(async () => {
  await fetch(`${origin}/__scenario`, { method: "POST", body: JSON.stringify({ scenario: "ok" }) });
});

function scenario(name: string, times?: number) {
  return fetch(`${origin}/__scenario`, {
    method: "POST",
    body: JSON.stringify({ scenario: name, times }),
  });
}

/** A real Yahoo client, token manager and transport talking to the stand-in. */
async function client() {
  let stored = {
    userId: "u1",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: 4_000_000_000,
    version: 1,
  };
  const storage: YahooTokenStorage = {
    getYahooToken: async () => stored,
    saveYahooToken: async (token) => {
      stored = { ...stored, ...token, version: stored.version + 1 };
      return stored;
    },
    deleteYahooToken: async () => undefined,
  };
  const sleeps: number[] = [];
  const created = await YahooApiClient.create(
    "u1",
    storage,
    {
      clientId: "id",
      clientSecret: "secret",
      providerRedirectUri: "http://127.0.0.1/callback",
      apiBaseUrl: `${origin}/fantasy/v2`,
      oauthBaseUrl: origin,
    },
    {
      now: () => Date.now(),
      sleep: async (ms) => void sleeps.push(ms),
    },
    () => undefined,
    {
      refresher: (token, id, secret, uri) =>
        refreshAccessToken(token, id, secret, uri, fetch, origin),
    }
  );
  return { client: created, sleeps, current: () => stored };
}

describe("the Yahoo stand-in, through the real transport", () => {
  it("replays the recorded league tables and roster", async () => {
    const { client: yahoo } = await client();
    const source = new YahooFantasyDataSource(new YahooLeagueResources(async () => yahoo), {
      now: () => Date.parse("2025-12-11T18:00:00Z"),
    });

    const season = await source.getSeason(LEAGUE);
    const current = await source.getWeek(LEAGUE, "current");
    const week3 = await source.getWeek(LEAGUE, 3);
    const roster = await getTeamRoster(`${LEAGUE}.t.3`, async () => yahoo);

    expect(season.teams).toHaveLength(14);
    expect(current.scope).toEqual({ kind: "week", week: 8 });
    expect(week3.scope).toEqual({ kind: "week", week: 3 });
    expect(week3.pairings).toHaveLength(7);
    expect(roster).toHaveLength(15);
  });

  it("answers 429 and the client waits for Retry-After before succeeding", async () => {
    await scenario("rate-limit", 1);
    const { client: yahoo, sleeps } = await client();

    await expect(yahoo.get(`/league/${LEAGUE};out=settings,standings`)).resolves.toBeTruthy();
    expect(sleeps).toEqual([1000]);
  });

  it("fails with a rate-limit error when Yahoo keeps limiting", async () => {
    await scenario("rate-limit");
    const { client: yahoo } = await client();

    await expect(yahoo.get(`/league/${LEAGUE};out=settings,standings`)).rejects.toBeInstanceOf(
      YahooRateLimitedError
    );
  });

  it("retries a 5xx and then reports Yahoo unavailable", async () => {
    await scenario("unavailable", 1);
    const first = await client();
    await expect(
      first.client.get(`/league/${LEAGUE};out=settings,standings`)
    ).resolves.toBeTruthy();

    await scenario("unavailable");
    const second = await client();
    await expect(
      second.client.get(`/league/${LEAGUE};out=settings,standings`)
    ).rejects.toBeInstanceOf(YahooUnavailableError);
  });

  it("answers 401 for an expired token and the client refreshes and stores the new one", async () => {
    await scenario("unauthorized");
    const { client: yahoo, current } = await client();

    await expect(yahoo.get(`/league/${LEAGUE};out=settings,standings`)).resolves.toBeTruthy();

    expect(current().accessToken).toMatch(/^standin-access-/);
    expect(current().version).toBe(2);
  });

  it("does not answer at all in the timeout scenario", async () => {
    await scenario("timeout");
    const controller = new AbortController();
    const pending = fetch(`${origin}/fantasy/v2/league/${LEAGUE};out=settings,standings`, {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 150);

    await expect(pending).rejects.toThrow();
  });

  it("rejects an unknown scenario and a path it has no recording for", async () => {
    const bad = await scenario("meltdown");
    const missing = await fetch(`${origin}/fantasy/v2/player/466.p.1/stats`);

    expect(bad.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
