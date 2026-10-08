import { vi } from "vitest";
import { defined } from "./defined";

/** A JSON response as the built-in fetch returns it. */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** A fetch that never reaches the network; queue responses with mockResolvedValueOnce or mockRejectedValueOnce. */
export function fakeFetch() {
  return vi.fn<typeof fetch>();
}

/** The error fetch throws when the request times out. */
export function timeoutError(): Error {
  return Object.assign(new Error("The operation was aborted due to timeout"), {
    name: "TimeoutError",
  });
}

/** The URL, method, headers and form body of a call a fake fetch received. */
export function requestOf(fetchFunction: ReturnType<typeof fakeFetch>, index = 0) {
  const [url, init] = defined(fetchFunction.mock.calls[index]);
  return {
    url: String(url),
    method: init?.method,
    headers: init?.headers as Record<string, string>,
    signal: init?.signal,
    form: new URLSearchParams(String(init?.body ?? "")),
  };
}
