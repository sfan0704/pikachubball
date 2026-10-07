import type { RequestContext, RequestScope } from "../../server/request-context";
import type { OwnerScopedStorage } from "../../server/storage/yahoo-token-storage";
import { fixedClock } from "./clock";
import { silentLogger } from "./dependencies";

/** A request scope with a silent logger and an empty Yahoo call counter. */
export function buildRequestScope(overrides: Partial<RequestScope> = {}): RequestScope {
  return {
    requestId: "req-test-1",
    logger: silentLogger,
    yahooCalls: { count: 0 },
    ...overrides,
  };
}

/** The context of a signed-in request; override only what a test cares about. */
export function buildRequestContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    ...buildRequestScope(),
    user: {
      userId: "test-user-id",
      yahooGuid: "testuser",
      displayName: "Test User",
      email: "test@example.com",
    },
    storage: {} as OwnerScopedStorage,
    clock: fixedClock(),
    yahooClient: async () => {
      throw new Error("yahooClient was not provided by this test");
    },
    ...overrides,
  };
}
