/**
 * One small wrapper over the built-in fetch for every Yahoo call: aborts after
 * a timeout and reports failures in the shape the request policy understands.
 */

/** Yahoo answered with a non-2xx status. */
export class ProviderHttpError extends Error {
  readonly response: { status: number; headers: Record<string, string> };

  constructor(
    status: number,
    headers: Record<string, string>,
    /** The parsed JSON error body when Yahoo sent one; never logged whole. */
    readonly data?: Record<string, unknown>
  ) {
    super(`Yahoo responded with HTTP ${status}`);
    this.name = "ProviderHttpError";
    this.response = { status, headers };
  }
}

/** The request timed out or never reached Yahoo. */
export class ProviderNetworkError extends Error {
  readonly isNetworkError = true;

  constructor(readonly code: string) {
    super(`Yahoo request failed: ${code}`);
    this.name = "ProviderNetworkError";
  }
}

export type FetchFunction = typeof fetch;

interface RequestOptions {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}

async function errorBody(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Sends one request and returns the parsed JSON body of a 2xx response. */
export async function requestJson(
  url: string,
  options: RequestOptions,
  timeoutMs: number,
  fetchFunction: FetchFunction = fetch
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFunction(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ProviderNetworkError(timedOut ? "ETIMEDOUT" : "ECONNRESET");
  }
  if (!response.ok) {
    throw new ProviderHttpError(
      response.status,
      Object.fromEntries(response.headers.entries()),
      await errorBody(response)
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderNetworkError("ECONNRESET");
  }
}
