import { AppError, type ErrorCode } from "../../shared/api/errors";

/** What a log line says about a failure: the error code and, for an unreadable Yahoo response, which paths failed. */
export interface FailureLogFields {
  readonly code: ErrorCode | "UNEXPECTED";
  readonly problems?: readonly string[];
}

function problemsOf(details: unknown): readonly string[] | undefined {
  if (typeof details !== "object" || details === null || !("problems" in details)) {
    return undefined;
  }
  const { problems } = details;
  return Array.isArray(problems) && problems.every((problem) => typeof problem === "string")
    ? problems
    : undefined;
}

/**
 * The log fields for an error. The problems list holds schema paths and zod
 * messages, never values from Yahoo, so it is safe to log; without it an
 * unreadable response looks the same as Yahoo being down.
 */
export function failureLogFields(error: unknown): FailureLogFields {
  if (!(error instanceof AppError)) {
    return { code: "UNEXPECTED" };
  }
  const problems = problemsOf(error.details);
  return problems === undefined ? { code: error.code } : { code: error.code, problems };
}
