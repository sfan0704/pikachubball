/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Window as HappyWindow } from "happy-dom";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const START_WIDTH = window.innerWidth;

function resizeTo(width: number) {
  act(() => {
    (window as unknown as HappyWindow).happyDOM.setViewport({ width });
  });
}

describe("useBreakpoint", () => {
  afterEach(() => resizeTo(START_WIDTH));

  it("names the layout the window is wide enough for, on the theme's breakpoints", () => {
    resizeTo(390);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("phone");
    resizeTo(767);
    expect(result.current).toBe("phone");
    resizeTo(768);
    expect(result.current).toBe("md");
    resizeTo(1099);
    expect(result.current).toBe("md");
    resizeTo(1100);
    expect(result.current).toBe("lg");
    resizeTo(390);
    expect(result.current).toBe("phone");
  });

  it("fails loudly when the theme's breakpoints are missing", () => {
    const root = document.documentElement.style;
    const lg = root.getPropertyValue("--breakpoint-lg");
    root.removeProperty("--breakpoint-lg");
    try {
      expect(() => renderHook(() => useBreakpoint())).toThrow("--breakpoint-lg");
    } finally {
      root.setProperty("--breakpoint-lg", lg);
    }
  });
});
