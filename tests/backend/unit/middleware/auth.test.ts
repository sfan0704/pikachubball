import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
  getOptionalUserId,
  createRequireAuth,
} from "../../../../server/middleware/auth";
import { UnauthorizedError } from "../../../../shared/api/errors";
import { anonymousSupabaseClient, buildTestDependencies } from "../../../support/dependencies";
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
    res = createMockResponse() as Response;
    next = createMockNext();
  });

  it("accepts an identity already verified for this request", async () => {
    req = createAuthenticatedRequest() as Request;

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("builds owner-scoped storage for a verified session", async () => {
    const storage = { marker: "owner-storage" };
    const createOwnerStorage = vi.fn().mockReturnValue(storage);
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
      })
    );

    await middleware(req, res, next);

    expect(createOwnerStorage).toHaveBeenCalledWith(verifiedClient, "user-1");
    expect(req.ownerStorage).toBe(storage);
    expect(req.authIdentity?.userId).toBe("user-1");
    expect(next).toHaveBeenCalledWith();
  });

  it("fails closed when no Supabase session can be verified", async () => {
    expect(anonymousSupabaseClient).toBeDefined();
    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("projects the verified subject and Yahoo identity", () => {
    req = createAuthenticatedRequest() as Request;

    expect(getAuthenticatedUserId(req)).toBe("test-user-id");
    expect(getAuthenticatedUser(req)).toEqual({
      id: "test-user-id",
      username: "testuser",
    });
    expect(getOptionalUserId(req)).toBe("test-user-id");
  });

  it("rejects getters before authentication", () => {
    expect(() => getAuthenticatedUserId(req)).toThrow(UnauthorizedError);
    expect(() => getAuthenticatedUser(req)).toThrow(UnauthorizedError);
    expect(getOptionalUserId(req)).toBeNull();
  });
});
