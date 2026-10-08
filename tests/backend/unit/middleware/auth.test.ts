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

  it("builds the request context for a verified session", async () => {
    const storage = { marker: "owner-storage" };
    const createOwnerStorage = vi.fn().mockReturnValue(storage);
    const yahooClient = { marker: "yahoo-client" };
    const createYahooClient = vi.fn().mockResolvedValue(yahooClient);
    const clock = fixedClock();
    const verifiedClient = {
      auth: {
        getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }),
        getUser: async () => ({
          data: {
            user: {
              id: "user-1",
              identities: [
                {
                  provider: "custom:yahoo",
                  identity_data: { iss: "https://api.login.yahoo.com", sub: "yahoo-guid-1" },
                },
              ],
              user_metadata: {},
              app_metadata: {},
            },
          },
          error: null,
        }),
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

    await middleware(req, res, next);

    expect(createOwnerStorage).toHaveBeenCalledWith(verifiedClient, "user-1");
    expect(req.context).toMatchObject({
      requestId: req.scope?.requestId,
      user: { userId: "user-1", yahooGuid: "yahoo-guid-1" },
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

  it("fails closed when no Supabase session can be verified", async () => {
    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.context).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("reports a missing request scope as a programming error, not a sign-in failure", async () => {
    req.scope = undefined;

    await requireAuth(req, res, next);

    const error = vi.mocked(next).mock.calls[0][0] as Error;
    expect(error).not.toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/request scope middleware/);
  });
});
