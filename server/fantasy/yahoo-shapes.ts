import { z } from "zod";
import { AppError } from "../../shared/api/errors";

/** Yahoo answered, but not with the structure the app relies on. */
export class YahooResponseError extends AppError {
  constructor(problems: readonly string[]) {
    super(
      "YAHOO_UNAVAILABLE",
      "Yahoo Fantasy sent data the app could not read. Please try again shortly.",
      { problems }
    );
    this.name = "YahooResponseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Yahoo describes one object as a list of small objects and empty lists
 * (`[{team_key}, {name}, [], {managers}]`). This merges them into one object.
 */
export function mergeFragments(value: unknown): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (isRecord(node)) {
      Object.assign(merged, node);
    }
  };
  visit(value);
  return merged;
}

/** An object that Yahoo writes as a list of fragments, validated once merged. */
export const fragments = <T extends z.ZodTypeAny>(schema: T) =>
  z.unknown().transform(mergeFragments).pipe(schema);

/** A collection written as `{"0": item, "1": item, "count": 2}`, validated item by item. */
export const indexed = <T extends z.ZodTypeAny>(item: T) =>
  z.record(z.string(), z.unknown()).transform((record, context): z.infer<T>[] => {
    const count = Number(record.count);
    if (!Number.isInteger(count) || count < 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid collection count" });
      return z.NEVER;
    }
    const items: z.infer<T>[] = [];
    for (let index = 0; index < count; index += 1) {
      const parsed = item.safeParse(record[String(index)]);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: [index, ...issue.path],
          });
        }
        return z.NEVER;
      }
      items.push(parsed.data);
    }
    return items;
  });

/** Yahoo sends numbers as numbers or as strings. */
export const yahooInteger = z.coerce.number().int();

/** Yahoo sends flags as 0/1, "0"/"1" or booleans. */
export const yahooFlag = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((value) => value === true || value === 1 || value === "1");

/** Parses with a schema and reports only the paths that failed, never the values. */
export function parseYahoo<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new YahooResponseError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    );
  }
  return result.data;
}

/** The first league section that has the given key, for example `settings` or `scoreboard`. */
export function leagueSection(sections: readonly unknown[], key: string): unknown {
  for (const section of sections) {
    if (isRecord(section) && key in section) {
      return section[key];
    }
  }
  throw new YahooResponseError([`league: missing "${key}"`]);
}
