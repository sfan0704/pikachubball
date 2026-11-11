/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FreshnessLabel } from "../../../client/src/features/daily-stats/FreshnessLabel";
import { freshnessLabel } from "../../../client/src/features/league/freshness";

const NOW = Date.parse("2026-11-12T01:00:00Z");
const MINUTE = 60_000;
const loaded = (minutesAgo: number, error: unknown = null) => ({
  data: {},
  dataUpdatedAt: NOW - minutesAgo * MINUTE,
  error,
});
const loading = { data: undefined, dataUpdatedAt: 0, error: null };

describe("freshness label", () => {
  it("shows the age of the last success", () => {
    expect(freshnessLabel([loaded(4)], NOW)).toEqual({ text: "Updated 4 min ago", stale: false });
  });

  it("shows the oldest section's age, ignoring sections without data", () => {
    expect(freshnessLabel([loaded(1), loaded(12), loading], NOW)?.text).toBe("Updated 12 min ago");
  });

  it("marks data stale when a section's last refresh failed", () => {
    expect(freshnessLabel([loaded(1), loaded(6, new Error("YAHOO_UNAVAILABLE"))], NOW)).toEqual({
      text: "Couldn't refresh. Showing data from 6 min ago",
      stale: true,
    });
  });

  it("shows nothing until a section has data", () => {
    expect(freshnessLabel([loading], NOW)).toBeNull();
    render(<FreshnessLabel sources={[loading]} now={NOW} />);
    expect(screen.queryByTestId("text-freshness")).not.toBeInTheDocument();
  });

  it("renders the label", () => {
    render(<FreshnessLabel sources={[loaded(0)]} now={NOW} />);
    expect(screen.getByTestId("text-freshness")).toHaveTextContent("Updated just now");
  });
});
