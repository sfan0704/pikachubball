/**
 * Yahoo's Fantasy JSON carries HTML-encoded text, e.g. a team named
 * "Ball don't lie" arrives as "Ball don&#39;t lie". React escapes text again,
 * so undecoded entities would render literally. Decoding happens once, where
 * Yahoo responses enter the server, and produces plain text (never HTML).
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g;

function decodeCodePoint(codePoint: number, original: string): string {
  if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
    return original;
  }
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    return original;
  }
  return String.fromCodePoint(codePoint);
}

/** Decodes HTML entities in one pass; unknown entities are left unchanged. */
export function decodeYahooText(text: string): string {
  if (!text.includes("&")) {
    return text;
  }
  return text.replace(ENTITY, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return decodeCodePoint(parseInt(body.slice(2), 16), match);
    }
    if (body.startsWith("#")) {
      return decodeCodePoint(parseInt(body.slice(1), 10), match);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Returns a copy of a parsed Yahoo response with every string value decoded. */
export function decodeYahooStrings<T>(value: T): T {
  if (typeof value === "string") {
    return decodeYahooText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => decodeYahooStrings(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, decodeYahooStrings(item)]),
    ) as T;
  }
  return value;
}
