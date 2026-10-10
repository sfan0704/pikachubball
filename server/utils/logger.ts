/* eslint-disable no-console -- the logger is the one place that writes to the console. */

/** Structured logger handed to code by the composition root. */
export interface Logger {
  debug(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
  /** A logger that adds these fields (for example the request id) to every line. */
  child(bindings: Record<string, unknown>): Logger;
}

/** Options the composition root chooses from configuration. */
export interface LoggerOptions {
  readonly debug: boolean;
}

const REDACTED_KEYS = /authorization|token|secret|password|cookie|api[-_]?key/i;

/**
 * Makes a value safe to write as JSON: errors keep only their name, message
 * and stack (never request config or headers), circular references are cut,
 * and anything that looks like a credential is replaced.
 */
function toLoggable(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value !== "object" || value === null) {
    return typeof value === "bigint" ? value.toString() : value;
  }
  if (seen.has(value) || depth > 4) {
    return "[truncated]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => toLoggable(item, seen, depth + 1));
  }
  const entries = Object.entries(value).map(([key, item]) => [
    key,
    REDACTED_KEYS.test(key) ? "[redacted]" : toLoggable(item, seen, depth + 1),
  ]);
  return Object.fromEntries(entries);
}

function isFieldBag(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

/**
 * One JSON line. A plain object right after the message becomes top-level
 * fields (so lines are easy to query); anything else goes under `details`.
 */
function formatLine(
  level: string,
  message: string,
  bindings: Record<string, unknown>,
  details: unknown[]
): string {
  const [first, ...rest] = details;
  const fields = isFieldBag(first) ? first : {};
  const extra = isFieldBag(first) ? rest : details;
  const entry: Record<string, unknown> = {
    ...(toLoggable({ ...bindings, ...fields }) as Record<string, unknown>),
    time: new Date().toISOString(),
    level,
    message,
  };
  if (extra.length > 0) {
    entry.details = extra.map((detail) => toLoggable(detail));
  }
  return JSON.stringify(entry);
}

function build(options: LoggerOptions, bindings: Record<string, unknown>): Logger {
  return {
    debug: (message, ...details) => {
      if (options.debug) console.log(formatLine("debug", message, bindings, details));
    },
    info: (message, ...details) => console.log(formatLine("info", message, bindings, details)),
    warn: (message, ...details) => console.warn(formatLine("warn", message, bindings, details)),
    error: (message, ...details) => console.error(formatLine("error", message, bindings, details)),
    child: (extra) => build(options, { ...bindings, ...extra }),
  };
}

/** Creates a logger writing one JSON object per line; debug lines only when enabled. */
export function createLogger(options: LoggerOptions): Logger {
  return build(options, {});
}

/**
 * Transitional default for modules that predate dependency injection (the
 * Yahoo client, league service, parsers and Yahoo auth). CAR-101, CAR-63 and
 * CAR-102 replace those modules and CAR-117 removes the parsers; new code
 * receives a Logger from the composition root instead.
 */
export const logger: Logger = createLogger({ debug: false });
