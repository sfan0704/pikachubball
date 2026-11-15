import { readFileSync } from "node:fs";

// Tests run from the repository root.
const INDEX_CSS = "client/src/index.css";
const BREAKPOINT = /--breakpoint-(md|lg):\s*([^;]+);/g;

/**
 * Puts the theme's breakpoints on :root, as the built stylesheet does, so
 * useBreakpoint works in happy-dom. Read from index.css so tests never repeat the widths.
 */
export function declareBreakpoints(): void {
  const css = readFileSync(INDEX_CSS, "utf8");
  const found = [...css.matchAll(BREAKPOINT)];
  if (found.length !== 2) {
    throw new Error("index.css should declare --breakpoint-md and --breakpoint-lg once each.");
  }
  for (const [, name, width] of found) {
    document.documentElement.style.setProperty(`--breakpoint-${name}`, width.trim());
  }
}
