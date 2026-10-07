import type { Logger } from "../../server/utils/logger";

/** One line a recording logger captured. */
export interface RecordedLine {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  /** Fields from `child()` bindings, merged with the first object passed as a detail. */
  readonly fields: Record<string, unknown>;
  readonly details: unknown[];
}

/** A logger that keeps what it is given, so tests can assert on log lines. */
export function recordingLogger(
  lines: RecordedLine[] = [],
  bindings: Record<string, unknown> = {}
): Logger & { lines: RecordedLine[] } {
  const write =
    (level: RecordedLine["level"]) =>
    (message: string, ...details: unknown[]) => {
      const [first] = details;
      const own = typeof first === "object" && first !== null && !Array.isArray(first) ? first : {};
      lines.push({ level, message, fields: { ...bindings, ...own }, details });
    };
  return {
    lines,
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
    child: (extra) => recordingLogger(lines, { ...bindings, ...extra }),
  };
}
