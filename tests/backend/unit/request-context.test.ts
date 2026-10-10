import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  createRequestContext,
  getRequestContext,
  type YahooClientCreator,
} from "../../../server/http/request-context";
import type { YahooApiClient } from "../../../server/fantasy/yahoo/yahoo-api-client";
import type { OwnerScopedStorage } from "../../../server/storage/yahoo-token-storage";
import { UnauthorizedError } from "../../../shared/api/errors";
import { fixedClock } from "../../support/clock";
import { buildRequestContext, buildRequestScope } from "../../support/context";

const user = { userId: "u1", yahooGuid: "g1", displayName: null, email: null };
const storage = {} as OwnerScopedStorage;

function contextWith(createYahooClient: YahooClientCreator) {
  const scope = buildRequestScope();
  const context = createRequestContext({
    scope,
    user,
    storage,
    clock: fixedClock(),
    createYahooClient,
  });
  return { scope, context };
}

describe("createRequestContext", () => {
  it("carries the scope, user, storage and clock", () => {
    const { scope, context } = contextWith(vi.fn());

    expect(context.requestId).toBe(scope.requestId);
    expect(context.logger).toBe(scope.logger);
    expect(context.user).toBe(user);
    expect(context.storage).toBe(storage);
  });

  it("does not create a Yahoo client until one is needed", () => {
    const createYahooClient = vi.fn();
    contextWith(createYahooClient);

    expect(createYahooClient).not.toHaveBeenCalled();
  });

  it("creates one Yahoo client per request, however many times it is asked for", async () => {
    const client = {} as YahooApiClient;
    const createYahooClient = vi.fn().mockResolvedValue(client);
    const { context } = contextWith(createYahooClient);

    const [first, second, third] = await Promise.all([
      context.yahooClient(),
      context.yahooClient(),
      context.yahooClient(),
    ]);

    expect(createYahooClient).toHaveBeenCalledTimes(1);
    expect(createYahooClient).toHaveBeenCalledWith("u1", storage, expect.any(Function));
    expect([first, second, third]).toEqual([client, client, client]);
  });

  it("reuses a failed creation instead of reading tokens again", async () => {
    const createYahooClient = vi.fn().mockRejectedValue(new Error("no connection"));
    const { context } = contextWith(createYahooClient);

    await expect(context.yahooClient()).rejects.toThrow("no connection");
    await expect(context.yahooClient()).rejects.toThrow("no connection");

    expect(createYahooClient).toHaveBeenCalledTimes(1);
  });

  it("counts Yahoo attempts on the request's scope", async () => {
    let report: () => void = () => {};
    const createYahooClient: YahooClientCreator = async (_userId, _storage, onRequest) => {
      report = onRequest;
      return {} as YahooApiClient;
    };
    const { scope, context } = contextWith(createYahooClient);
    await context.yahooClient();

    report();
    report();

    expect(scope.yahooCalls.count).toBe(2);
  });
});

describe("getRequestContext", () => {
  it("returns the context the auth middleware built", () => {
    const context = buildRequestContext();
    expect(getRequestContext({ context } as Request)).toBe(context);
  });

  it("rejects a request that never passed the auth middleware", () => {
    expect(() => getRequestContext({} as Request)).toThrow(UnauthorizedError);
  });
});
