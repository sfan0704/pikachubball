import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const config = z
  .object({ rewrites: z.array(z.object({ source: z.string(), destination: z.string() })) })
  .parse(JSON.parse(readFileSync("vercel.json", "utf8")));

function destination(path: string): string | undefined {
  return config.rewrites.find(({ source }) => {
    const prefix = source.split("/:path*")[0];
    return source.endsWith("/:path*")
      ? path === prefix || path.startsWith(`${prefix}/`)
      : path === source;
  })?.destination;
}

describe("deployed routing", () => {
  it.each([
    "/auth",
    "/leagues/466.l.1/teams/466.l.1.t.1/season",
    "/leagues/466.l.1/teams/466.l.1.t.1/week/2",
  ])("serves the single-page app when opening %s directly", (path) => {
    expect(destination(path)).toBe("/index.html");
  });

  it("keeps API requests on Express and leaves static asset lookup to Vercel", () => {
    expect(destination("/api/leagues/466.l.1/season")).toBe("/api/index");
    expect(destination("/assets/missing.js")).toBeUndefined();
  });
});
