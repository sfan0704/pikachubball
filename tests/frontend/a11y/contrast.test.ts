import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

const CSS = readFileSync("client/src/index.css", "utf8");

/** The `--name: H S% L%` tokens declared in the block that starts at `selector`. */
function tokens(selector: string): Record<string, Rgb> {
  const start = CSS.indexOf(`${selector} {`);
  const block = CSS.slice(start, CSS.indexOf("\n}", start));
  const found: Record<string, Rgb> = {};
  for (const [, name, h, s, l] of block.matchAll(
    /--([a-z-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g
  )) {
    found[name] = hslToRgb(Number(h), Number(s) / 100, Number(l) / 100);
  }
  return found;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** `top` drawn at `alpha` over `bottom`. */
function blend(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  return top.map((value, i) => value * alpha + bottom[i] * (1 - alpha)) as Rgb;
}

const THEMES = { light: tokens(":root"), dark: tokens(".dark") };
const PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["primary", "background"],
  ["destructive", "background"],
];

describe("theme colours meet WCAG 2.1 AA (4.5:1 for text)", () => {
  for (const [theme, colours] of Object.entries(THEMES)) {
    it.each(PAIRS)(`${theme}: %s on %s`, (foreground, background) => {
      expect(colours[foreground], `--${foreground}`).toBeDefined();
      expect(colours[background], `--${background}`).toBeDefined();

      expect(contrast(colours[foreground], colours[background])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: text on the strongest heatmap shade stays readable`, () => {
      const shade = blend(colours.primary, colours.background, 0.6);

      expect(contrast(colours.foreground, shade)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("uses Tailwind colours for win, loss and tie text that read on both themes", () => {
    const text = { green: [21, 128, 61], yellow: [161, 98, 7], red: [185, 28, 28] } as const; // 700
    const darkText = {
      green: [74, 222, 128],
      yellow: [250, 204, 21],
      red: [248, 113, 113],
    } as const; // 400

    for (const colour of Object.values(text)) {
      expect(contrast([...colour] as Rgb, THEMES.light.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast([...colour] as Rgb, THEMES.light.card)).toBeGreaterThanOrEqual(4.5);
    }
    for (const colour of Object.values(darkText)) {
      expect(contrast([...colour] as Rgb, THEMES.dark.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast([...colour] as Rgb, THEMES.dark.card)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
