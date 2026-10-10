/**
 * A stand-in for Yahoo's Fantasy API and OAuth endpoints, for local development
 * and the browser tests. It replays the scrubbed recorded responses through the
 * app's real transport, and can be told to fail like Yahoo does. It listens on
 * loopback only and holds no real data or credentials.
 */
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";

/** How the stand-in answers Fantasy API requests. */
export type Scenario = "ok" | "timeout" | "rate-limit" | "unavailable" | "unauthorized";

const SCENARIOS: readonly Scenario[] = [
  "ok",
  "timeout",
  "rate-limit",
  "unavailable",
  "unauthorized",
];

export interface StandInOptions {
  /** The folder with the recorded, scrubbed responses (tests/backend/fixtures/yahoo). */
  readonly fixturesDir: string;
}

type Json = Record<string, unknown>;

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The scoreboard of a week fixture, relabelled as another week. */
function withWeek(fixture: Json, week: number): Json {
  const copy = JSON.parse(JSON.stringify(fixture)) as Json;
  const league = (copy.fantasy_content as Json).league as unknown[];
  for (const section of league) {
    if (isJson(section) && isJson(section.scoreboard)) {
      section.scoreboard.week = String(week);
    }
  }
  return copy;
}

type Fixtures = Record<"season" | "current" | "week" | "roster", Json>;

/** The recorded response for a Fantasy API path, or null when nothing was recorded for it. */
function recorded(path: string, fixtures: Fixtures): Json | null {
  const league = /^\/fantasy\/v2\/league\/[^/;]+;out=(.+)$/.exec(path)?.[1];
  if (league === "settings,standings") {
    return fixtures.season;
  }
  if (league === "settings,scoreboard") {
    return fixtures.current;
  }
  const week = /^settings\/scoreboard;week=(\d+)$/.exec(league ?? "")?.[1];
  if (week) {
    return withWeek(fixtures.week, Number(week));
  }
  return /^\/fantasy\/v2\/team\/[^/]+\/roster$/.test(path) ? fixtures.roster : null;
}

const FAILURES: Partial<Record<Scenario, [number, Json, Record<string, string>?]>> = {
  "rate-limit": [429, { error: "rate limited" }, { "Retry-After": "1" }],
  unavailable: [503, { error: "unavailable" }],
  unauthorized: [401, { error: "token_expired" }],
};

class StandIn {
  private readonly fixtures: Fixtures;
  private scenario: Scenario = "ok";
  private remaining: number | null = null;
  private tokenCounter = 0;
  private validToken: string | null = null;
  private requests: string[] = [];

  constructor(fixturesDir: string) {
    const load = (name: string): Json =>
      JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), "utf8")) as Json;
    this.fixtures = {
      season: load("league-season"),
      current: load("league-current-week"),
      week: load("league-week-1"),
      roster: load("team-roster"),
    };
  }

  handle(req: IncomingMessage, res: ServerResponse): void {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (path.startsWith("/__")) {
      void this.control(req, res, path);
    } else if (path.startsWith("/oauth2/")) {
      void this.oauth(req, res, path);
    } else {
      this.requests.push(path);
      this.api(req, res, path);
    }
  }

  /** The failure to answer with right now, counting this request against the scenario. */
  private failure(req: IncomingMessage): Scenario | null {
    if (this.scenario === "unauthorized") {
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      return this.validToken !== null && token === this.validToken ? null : "unauthorized";
    }
    if (this.scenario === "ok") {
      return null;
    }
    const active = this.scenario;
    if (this.remaining !== null && --this.remaining <= 0) {
      this.scenario = "ok";
      this.remaining = null;
    }
    return active;
  }

  private api(req: IncomingMessage, res: ServerResponse, path: string): void {
    const failed = this.failure(req);
    if (failed === "timeout") {
      return; // never answer; the client gives up
    }
    const failure = failed ? FAILURES[failed] : undefined;
    if (failure) {
      return send(res, failure[0], failure[1], failure[2]);
    }
    const body = recorded(path, this.fixtures);
    send(res, body ? 200 : 404, body ?? { error: "not recorded", path });
  }

  private async oauth(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const form = new URLSearchParams(await readBody(req));
    if (path === "/oauth2/revoke") {
      return send(res, 200, {});
    }
    if (form.get("grant_type") !== "refresh_token" || form.get("refresh_token") === "revoked") {
      return send(res, 400, { error: "invalid_grant" });
    }
    this.tokenCounter += 1;
    this.validToken = `standin-access-${this.tokenCounter}`;
    send(res, 200, {
      access_token: this.validToken,
      refresh_token: `standin-refresh-${this.tokenCounter}`,
      expires_in: 3600,
      token_type: "bearer",
    });
  }

  private async control(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    if (path === "/__state") {
      return send(res, 200, { scenario: this.scenario, requests: this.requests });
    }
    const body = JSON.parse((await readBody(req)) || "{}") as { scenario?: string; times?: number };
    const scenario = SCENARIOS.find((candidate) => candidate === body.scenario);
    if (!scenario) {
      return send(res, 400, { error: `scenario must be one of ${SCENARIOS.join(", ")}` });
    }
    this.scenario = scenario;
    this.remaining = typeof body.times === "number" ? body.times : null;
    this.validToken = null;
    this.requests = [];
    send(res, 200, { scenario });
  }
}

export function createYahooStandIn({ fixturesDir }: StandInOptions): Server {
  const standIn = new StandIn(fixturesDir);
  return createServer((req, res) => standIn.handle(req, res));
}
