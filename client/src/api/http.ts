import type { z } from "zod";
import { errorBodySchema } from "@shared/api/errors";
import { ApiError } from "./errors";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Aborts the request, for example when the user navigates away. */
  signal?: AbortSignal;
}

function retryAfter(response: Response): number | null {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isInteger(seconds) && seconds >= 0 && response.headers.has("Retry-After")
    ? seconds
    : null;
}

async function failureFrom(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = errorBodySchema.safeParse(body);
  if (!parsed.success) {
    return new ApiError(
      "INTERNAL_ERROR",
      `Unexpected response (${response.status})`,
      response.status
    );
  }
  const { code, message, requestId } = parsed.data;
  return new ApiError(code, message, response.status, requestId, retryAfter(response));
}

/**
 * The only place in the client that calls `fetch`. Sends the session cookie,
 * turns every failure into an ApiError and checks a success body against the
 * shared schema, so screens never see an unvalidated response. An aborted
 * request rejects with the browser's AbortError so callers can ignore it.
 */
export async function apiRequest<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  { method = "GET", body, signal }: RequestOptions = {}
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new ApiError("NETWORK_ERROR", "Could not reach the server", null);
  }

  if (!response.ok) {
    throw await failureFrom(response);
  }
  const parsed = schema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    throw new ApiError(
      "INVALID_RESPONSE",
      "The server sent a response the app can't read",
      response.status
    );
  }
  return parsed.data;
}
