/**
 * Removes names and personal details from a recorded Yahoo response while
 * keeping its structure, so the committed fixture is safe to publish and still
 * has the shape the parsers must handle.
 */

const OPAQUE_ID_KEYS = new Set(["guid", "manager_id"]);
// The chat identifiers lead to the league's group chat.
const DROPPED_KEYS = new Set(["email", "nickname", "sendbird_channel_url", "iris_group_chat_id"]);
// Transactions and ownership name teams under their own keys, outside the team resource.
const TEAM_NAME_KEYS = new Set([
  "source_team_name",
  "destination_team_name",
  "trader_team_name",
  "tradee_team_name",
  "owner_team_name",
]);
// Every link goes: some carry the league's invitation key, others identify people.
const URL = /^https?:\/\//;

/** Yahoo lists a resource's properties as sibling single-key objects in one array. */
const NAMED_RESOURCE_KEYS = [
  { idKey: "team_key", label: "Team" },
  { idKey: "league_key", label: "League" },
] as const;

class Pseudonyms {
  private readonly seen = new Map<string, string>();
  readonly removed = new Set<string>();

  /** The same input always maps to the same placeholder, so references stay linked. */
  of(prefix: string, value: string): string {
    this.removed.add(value);
    const key = `${prefix}:${value}`;
    const existing = this.seen.get(key);
    if (existing) {
      return existing;
    }
    const created = `${prefix}-${this.seen.size + 1}`;
    this.seen.set(key, created);
    return created;
  }

  drop(value: unknown): string {
    if (typeof value === "string") {
      this.removed.add(value);
    }
    return "scrubbed";
  }
}

function resourceLabel(siblings: readonly unknown[]): string | undefined {
  for (const { idKey, label } of NAMED_RESOURCE_KEYS) {
    if (siblings.some((item) => isRecord(item) && idKey in item)) {
      return label;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The placeholder for a personal string, or undefined when the string can stay. */
function scrubString(
  key: string,
  value: string,
  label: string | undefined,
  names: Pseudonyms
): string | undefined {
  if (OPAQUE_ID_KEYS.has(key)) {
    return names.of(key, value);
  }
  if (TEAM_NAME_KEYS.has(key)) {
    return names.of("Team", value);
  }
  if (URL.test(value)) {
    names.drop(value);
    return "https://example.invalid/scrubbed";
  }
  return key === "name" && label ? names.of(label, value) : undefined;
}

function scrubRecord(
  record: Record<string, unknown>,
  label: string | undefined,
  names: Pseudonyms
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const replaced = typeof value === "string" ? scrubString(key, value, label, names) : undefined;
    if (DROPPED_KEYS.has(key)) {
      out[key] = names.drop(value);
    } else {
      out[key] = replaced ?? scrubValue(value, names);
    }
  }
  return out;
}

function scrubValue(value: unknown, names: Pseudonyms, label?: string): unknown {
  if (Array.isArray(value)) {
    const siblingLabel = resourceLabel(value.flat());
    return value.map((item) => scrubValue(item, names, siblingLabel ?? label));
  }
  if (isRecord(value)) {
    return scrubRecord(value, label, names);
  }
  return value;
}

/**
 * Scrubs several responses with one set of placeholders, so the same team or
 * manager has the same placeholder in every file of a capture.
 */
export class YahooScrubber {
  private readonly names = new Pseudonyms();

  /** A copy of the response with names, identifiers, emails and links replaced. */
  scrub(response: unknown): unknown {
    return scrubValue(response, this.names);
  }

  /** Personal values removed so far that still appear in the text, for a final check. */
  leaksIn(text: string): string[] {
    return [...this.names.removed].filter((value) => value.length >= 3 && text.includes(value));
  }
}
