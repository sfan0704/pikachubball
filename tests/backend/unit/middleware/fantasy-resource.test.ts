import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  leagueKeyFromTeamKey,
  requireOwnedFantasyResource,
} from "../../../../server/http/middleware/fantasy-resource";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../../../../shared/api/errors";
import { createMockNext, createMockRequest, createMockResponse } from "../../fixtures/test-helpers";
import { buildRequestContext } from "../../../support/context";
import type { OwnerScopedStorage } from "../../../../server/storage/yahoo-token-storage";

function requestOwning(ownsFantasyResource: OwnerScopedStorage["ownsFantasyResource"]) {
  const req = createMockRequest() as Request;
  req.context = buildRequestContext({ storage: { ownsFantasyResource } as OwnerScopedStorage });
  return req;
}

describe("requireOwnedFantasyResource", () => {
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    res = createMockResponse() as Response;
    next = createMockNext();
  });

  it("derives and verifies the exact league/team pair", async () => {
    const ownsFantasyResource = vi.fn().mockResolvedValue(true);
    const req = requestOwning(ownsFantasyResource);
    req.params = { teamKey: "466.l.12345.t.7" };

    await requireOwnedFantasyResource(req, res, next);

    expect(leagueKeyFromTeamKey("466.l.12345.t.7")).toBe("466.l.12345");
    expect(ownsFantasyResource).toHaveBeenCalledWith("466.l.12345", "466.l.12345.t.7");
    expect(next).toHaveBeenCalledWith();
  });

  it("verifies a league key on its own", async () => {
    const ownsFantasyResource = vi.fn().mockResolvedValue(true);
    const req = requestOwning(ownsFantasyResource);
    req.params = { leagueKey: "466.l.12345" };

    await requireOwnedFantasyResource(req, res, next);

    expect(ownsFantasyResource).toHaveBeenCalledWith("466.l.12345", undefined);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a forged or cross-league team pair before Yahoo is called", async () => {
    const ownsFantasyResource = vi.fn().mockResolvedValue(false);
    const req = requestOwning(ownsFantasyResource);
    req.params = {
      leagueKey: "466.l.owner-league",
      teamKey: "466.l.foreign-league.t.9",
    };

    await requireOwnedFantasyResource(req, res, next);

    expect(ownsFantasyResource).toHaveBeenCalledWith(
      "466.l.owner-league",
      "466.l.foreign-league.t.9"
    );
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("requires a league key it can derive", async () => {
    const ownsFantasyResource = vi.fn();
    const req = requestOwning(ownsFantasyResource);
    req.params = { teamKey: "not-a-team-key" };

    await requireOwnedFantasyResource(req, res, next);

    expect(ownsFantasyResource).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("fails when the request has no auth context", async () => {
    const req = createMockRequest() as Request;
    req.params = { leagueKey: "466.l.12345" };

    await requireOwnedFantasyResource(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
