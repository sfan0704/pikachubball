import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
  getOptionalUserId,
  requireAuth,
} from "../../../../server/middleware/auth";
import { UnauthorizedError } from "../../../../server/middleware/error-handler";
import {
  createAuthenticatedRequest,
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../../fixtures/test-helpers";

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

  it("fails closed when no Supabase session can be verified", async () => {
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
    expect(next).not.toHaveBeenCalled();
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
