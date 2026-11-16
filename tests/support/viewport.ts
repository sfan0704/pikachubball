import { act } from "@testing-library/react";
import type { Window as HappyWindow } from "happy-dom";

/** The width happy-dom starts at (1024, the md layout), to restore after a test resizes. */
export const START_WIDTH = window.innerWidth;

/** Resizes happy-dom's window, which fires the breakpoints' media query changes. */
export function resizeTo(width: number): void {
  act(() => {
    (window as unknown as HappyWindow).happyDOM.setViewport({ width });
  });
}
