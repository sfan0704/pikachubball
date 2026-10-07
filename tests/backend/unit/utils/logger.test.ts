import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../../../../server/utils/logger";

/** Parses the one JSON line a console spy received. */
function lineOf(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(String(spy.mock.calls[0][0]));
}

describe("logger", () => {
  let log: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes one JSON object per line with time, level and message", () => {
    createLogger({ debug: false }).info("Hello", { leagueCount: 2 });

    expect(lineOf(log)).toMatchObject({ level: "info", message: "Hello", leagueCount: 2 });
    expect(lineOf(log)).not.toHaveProperty("details");
    expect(Date.parse(String(lineOf(log).time))).not.toBeNaN();
  });

  it("sends warnings and errors to their own console streams", () => {
    const logger = createLogger({ debug: false });
    logger.warn("careful");
    logger.error("broken");

    expect(lineOf(warn).level).toBe("warn");
    expect(lineOf(error).level).toBe("error");
    expect(log).not.toHaveBeenCalled();
  });

  it("keeps time, level and message even if the fields use those names", () => {
    createLogger({ debug: false }).info("real", { level: "fake", message: "fake", time: "fake" });

    expect(lineOf(log)).toMatchObject({ level: "info", message: "real" });
    expect(Date.parse(String(lineOf(log).time))).not.toBeNaN();
  });

  it("puts values that aren't a plain object under details", () => {
    createLogger({ debug: false }).info("mixed", "text", 42, [1, 2]);

    expect(lineOf(log).details).toEqual(["text", 42, [1, 2]]);
  });

  it("writes debug lines only when debug is enabled", () => {
    createLogger({ debug: false }).debug("quiet");
    expect(log).not.toHaveBeenCalled();

    createLogger({ debug: true }).debug("loud");
    expect(lineOf(log)).toMatchObject({ level: "debug", message: "loud" });
  });

  it("adds a child logger's fields to every line", () => {
    createLogger({ debug: false }).child({ requestId: "r1" }).child({ route: "/x" }).info("done");

    expect(lineOf(log)).toMatchObject({ requestId: "r1", route: "/x", message: "done" });
  });

  it("keeps an error's name, message and stack but never its request config", () => {
    const failure = Object.assign(new Error("Request failed with status code 403"), {
      config: { headers: { Authorization: "Bearer secret-access-token" } },
    });

    createLogger({ debug: false }).error("Yahoo call failed", failure);

    const entry = lineOf(error);
    expect(entry.details).toEqual([
      expect.objectContaining({ name: "Error", message: "Request failed with status code 403" }),
    ]);
    expect(JSON.stringify(entry)).not.toContain("secret-access-token");
  });

  it("redacts credentials by field name", () => {
    createLogger({ debug: false }).info("saving", {
      accessToken: "a-secret",
      nested: { refreshToken: "r-secret", clientSecret: "c-secret", ok: 1 },
      authorization: "Bearer x",
    });

    const text = JSON.stringify(lineOf(log));
    expect(text).not.toMatch(/a-secret|r-secret|c-secret|Bearer x/);
    expect(text).toContain('"ok":1');
  });

  it("survives circular structures", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;

    createLogger({ debug: false }).info("circular", circular);

    expect(JSON.stringify(lineOf(log))).toContain("[truncated]");
  });
});
