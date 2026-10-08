import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "tests/backend/fixtures/yahoo";
const files = readdirSync(DIR).filter((name) => name.endsWith(".json"));

/** Patterns that must never appear in a committed recording. */
const FORBIDDEN: [string, RegExp][] = [
  ["an email address", /[\w.+-]+@[\w-]+\.[\w.]+/],
  ["a Yahoo GUID", /"guid":\s*"[A-Z0-9]{20,}"/],
  ["a bearer or OAuth token", /(access_token|refresh_token|Bearer\s)\S{10,}/i],
  ["a client secret", /client_secret/i],
  ["a profile or logo image address", /(yimg\.com|cloudinary|fantasy-logos|\.jpg|\.png)/i],
  ["an invitation link or key", /(invitation\?key|ikey=|short_invitation_url|invite_url)/i],
  [
    "non-Latin text (team and league names are scrubbed)",
    /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ],
  ["a real league id", /\.l\.(?!100000\b)\d{4,}/],
];

describe("recorded Yahoo responses carry no secrets or personal details", () => {
  it("has recordings to scan", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(files)("%s", (file) => {
    const text = readFileSync(`${DIR}/${file}`, "utf8");

    for (const [what, pattern] of FORBIDDEN) {
      expect(pattern.test(text), `${file} contains ${what}`).toBe(false);
    }
  });
});
