import { useSyncExternalStore } from "react";

/** The layout the window is wide enough for: the phone's, md's top bar over one column, or lg's desktop layouts. */
export type Breakpoint = "phone" | "md" | "lg";

/** A min-width query on one of the theme's breakpoints, whose width is a CSS variable on :root (index.css). */
function widthQuery(name: Exclude<Breakpoint, "phone">): MediaQueryList {
  const width = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(`--breakpoint-${name}`)
    .trim();
  if (width === "") {
    throw new Error(`The theme declares no --breakpoint-${name}.`);
  }
  return window.matchMedia(`(min-width: ${width})`);
}

function currentBreakpoint(): Breakpoint {
  if (widthQuery("lg").matches) {
    return "lg";
  }
  return widthQuery("md").matches ? "md" : "phone";
}

function subscribe(onChange: () => void): () => void {
  const queries = [widthQuery("md"), widthQuery("lg")];
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

/**
 * The breakpoint the window is at, following resizes. Only for the choices CSS
 * can't make, such as a sheet or a panel; layout itself stays in CSS variants.
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, currentBreakpoint);
}
