import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  leagueKeyFromTeamKey,
  requireOwnedFantasyResource,
  requireYahooAuth,
} from "../../../../server/middleware/yahoo-auth";
import { getAuthenticatedUserId } from "../../../../server/middleware/auth";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../../../server/middleware/error-handler";
import {
  createAuthenticatedRequest,
  createMockNext,
  createMockResponse,
  createMockUser,
} from "../../fixtures/test-helpers";
import type { OwnerScopedStorage } from "../../../../server/storage/yahoo-token-storage";

vi.mock("../../../../server/middleware/auth");

function ownerStorage(overrides: Partial<OwnerScopedStorage> = {}): OwnerScopedStorage {
  return {
    saveYahooConnection: vi.fn(),
    saveYahooToken: vi.fn(),
    getYahooToken: vi.fn(),
    deleteYahooToken: vi.fn(),
    replaceFantasyMemberships: vi.fn(),
    ownsFantasyResource: vi.fn(),
    ...overrides,
  };
}

describe("Yahoo owner middleware", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    req = createAuthenticatedRequest(user) as Request;
    res = createMockResponse() as Response;
    next = createMockNext();
  });

  it("requires a Yahoo connection from the request-scoped repository", async () => {
    const getYahooToken = vi.fn().mockResolvedValue({
      userId: user.id,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 1_800_000_000,
    });
    req.ownerStorage = ownerStorage({ getYahooToken });
    vi.mocked(getAuthenticatedUserId).mockReturnValue(user.id);

    await requireYahooAuth(req, res, next);

    expect(getYahooToken).toHaveBeenCalledWith(user.id);
    expect(next).toHaveBeenCalledWith();
  });

  it("fails when authentication or owner storage is absent", async () => {
    vi.mocked(getAuthenticatedUserId).mockImplementation(() => {
      throw new UnauthorizedError("Authentication required");
    });
    await requireYahooAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));

    vi.clearAllMocks();
    vi.mocked(getAuthenticatedUserId).mockReturnValue(user.id);
    await requireYahooAuth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("rejects an owner without a Yahoo connection", async () => {
    req.ownerStorage = ownerStorage({ getYahooToken: vi.fn().mockResolvedValue(null) });
    vi.mocked(getAuthenticatedUserId).mockReturnValue(user.id);

    await requireYahooAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it("derives and verifies the exact league/team pair", async () => {
    const ownsFantasyResource = vi.fn().mockResolvedValue(true);
    req.ownerStorage = ownerStorage({ ownsFantasyResource });
    req.params = { teamKey: "466.l.12345.t.7" };

    await requireOwnedFantasyResource(req, res, next);

    expect(leagueKeyFromTeamKey("466.l.12345.t.7")).toBe("466.l.12345");
    expect(ownsFantasyResource).toHaveBeenCalledWith(
      "466.l.12345",
      "466.l.12345.t.7",
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a forged or cross-league team pair before Yahoo is called", async () => {
    const ownsFantasyResource = vi.fn().mockResolvedValue(false);
    req.ownerStorage = ownerStorage({ ownsFantasyResource });
    req.params = {
      leagueKey: "466.l.owner-league",
      teamKey: "466.l.foreign-league.t.9",
    };

    await requireOwnedFantasyResource(req, res, next);

    expect(ownsFantasyResource).toHaveBeenCalledWith(
      "466.l.owner-league",
      "466.l.foreign-league.t.9",
    );
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
