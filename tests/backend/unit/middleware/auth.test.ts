import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createRequireAuth } from "../../../../server/http/middleware/auth";
import { UnauthorizedError } from "../../../../shared/api/errors";
import { buildTestDependencies } from "../../../support/dependencies";
import { buildRequestScope } from "../../../support/context";
import { fixedClock } from "../../../support/clock";
import {
  createAuthenticatedRequest,
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../../fixtures/test-helpers";

const requireAuth = createRequireAuth(buildTestDependencies());

describe("Supabase auth middleware", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = createMockRequest() as Request;
    req.scope = buildRequestScope();
    res = createMockResponse() as Response;
    next = createMockNext();
  });

  it("accepts an identity already verified for this request", async () => {
    req = createAuthenticatedRequest() as Request;

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("builds the request context from the signed claims and one database call", async () => {
    const openRequest = vi.fn().mockResolvedValue({ yahooGuid: "yahoo-guid-1", displayName: "A" });
    const storage = { openRequest };
    const createOwnerStorage = vi.fn().mockReturnValue(storage);
    const yahooClient = { marker: "yahoo-client" };
    const createYahooClient = vi.fn().mockResolvedValue(yahooClient);
    const clock = fixedClock();
    const getUser = vi.fn();
    const rpc = vi.fn();
    const verifiedClient = {
      rpc,
      auth: {
        getClaims: async () => ({
          data: { claims: { sub: "user-1", email: "a@example.test" } },
          error: null,
        }),
        getUser,
      },
    };
    const middleware = createRequireAuth(
      buildTestDependencies({
        createSupabaseClient: () => verifiedClient as never,
        createOwnerStorage,
        createYahooClient,
        clock,
      })
    );
    req.params = { key: "466.l.100000", team: "466.l.100000.t.11" };

    await middleware(req, res, next);

    expect(createOwnerStorage).toHaveBeenCalledWith(verifiedClient, "user-1");
    expect(openRequest).toHaveBeenCalledExactlyOnceWith("466.l.100000");
    // No auth-server lookup and no other database call: openRequest is the one round trip.
    expect(getUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(req.context).toMatchObject({
      requestId: req.scope?.requestId,
      user: {
        userId: "user-1",
        yahooGuid: "yahoo-guid-1",
        displayName: "A",
        email: "a@example.test",
      },
      storage,
      clock,
    });
    expect(next).toHaveBeenCalledWith();
    // The Yahoo client is created lazily, on first use, and only once.
    expect(createYahooClient).not.toHaveBeenCalled();
    await req.context?.yahooClient();
    await req.context?.yahooClient();
    expect(createYahooClient).toHaveBeenCalledTimes(1);
  });

  it("opens a request with no league on routes that name none", async () => {
    const openRequest = vi.fn().mockResolvedValue({ yahooGuid: "g", displayName: null });
    const middleware = createRequireAuth(
      buildTestDependencies({
        createSupabaseClient: () =>
          ({
            auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }) },
          }) as never,
        createOwnerStorage: () => ({ openRequest }) as never,
      })
    );
    req.params = {};

    await middleware(req, res, next);

    expect(openRequest).toHaveBeenCalledExactlyOnceWith(null);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a signed token whose session is no longer live", async () => {
    const middleware = createRequireAuth(
      buildTestDependencies({
        createSupabaseClient: () =>
          ({
            auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }) },
          }) as never,
        createOwnerStorage: () =>
          ({
            openRequest: vi
              .fn()
              .mockRejectedValue(new Error("Supabase session is no longer active")),
          }) as never,
      })
    );

    await middleware(req, res, next);

    expect(req.context).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("fails closed when no Supabase session can be verified", async () => {
    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.context).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("reports a missing request scope as a programming error, not a sign-in failure", async () => {
    req.scope = undefined;

    await requireAuth(req, res, next);

    const error = vi.mocked(next).mock.calls[0][0] as unknown as Error;
    expect(error).not.toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/request scope middleware/);
  });
});
