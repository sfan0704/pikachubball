import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import {
  createErrorHandler,
  asyncHandler,
  statusForCode,
} from "../../../../server/middleware/error-handler";
import {
  AppError,
  ConflictError,
  ERROR_CODES,
  errorBodySchema,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../../../shared/api/errors";
import { createMockRequest, createMockResponse, createMockNext } from "../../fixtures/test-helpers";
import type { Logger } from "../../../../server/utils/logger";
import { buildRequestScope } from "../../../support/context";

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
};
const errorHandler = createErrorHandler({ logger, exposeErrorDetails: false });
const developmentErrorHandler = createErrorHandler({ logger, exposeErrorDetails: true });

describe("errorHandler middleware", () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      ...createMockRequest(),
      scope: buildRequestScope({ requestId: "req-123" }),
    } as unknown as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe("error classes", () => {
    it.each([
      [new ValidationError("Invalid input"), "VALIDATION_ERROR", "Invalid input"],
      [new NotFoundError("User"), "NOT_FOUND", "User not found"],
      [new UnauthorizedError("Not logged in"), "UNAUTHORIZED", "Not logged in"],
      [new ForbiddenError("No access"), "FORBIDDEN", "No access"],
      [new ConflictError("Already exists"), "CONFLICT", "Already exists"],
    ])("%s carries its code and no HTTP status", (error, code, message) => {
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error).not.toHaveProperty("statusCode");
    });
  });

  describe("statusForCode", () => {
    it.each([
      ["UNAUTHORIZED", 401],
      ["YAHOO_RECONNECT_REQUIRED", 401],
      ["FORBIDDEN", 403],
      ["NOT_FOUND", 404],
      ["CONFLICT", 409],
      ["VALIDATION_ERROR", 400],
      ["RATE_LIMITED", 429],
      ["YAHOO_RATE_LIMITED", 429],
      ["YAHOO_UNAVAILABLE", 503],
      ["INTERNAL_ERROR", 500],
    ] as const)("maps %s to %i", (code, status) => {
      expect(statusForCode(code)).toBe(status);
    });

    it("covers every error code", () => {
      for (const code of ERROR_CODES) {
        expect(statusForCode(code)).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe("errorHandler", () => {
    it("sends { code, message, requestId } with the mapped status", () => {
      errorHandler(new ForbiddenError("Not your league"), mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        code: "FORBIDDEN",
        message: "Not your league",
        requestId: "req-123",
      });
      expect(errorBodySchema.parse((mockRes as unknown as { body: unknown }).body)).toBeTruthy();
    });

    it("includes details when the error has them", () => {
      errorHandler(new ValidationError("Bad week", { week: "abc" }), mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        code: "VALIDATION_ERROR",
        message: "Bad week",
        requestId: "req-123",
        details: { week: "abc" },
      });
    });

    it("sets Retry-After when the error says how long to wait", () => {
      errorHandler(
        new AppError("YAHOO_RATE_LIMITED", "Slow down", { retryAfterSeconds: 30 }),
        mockReq,
        mockRes,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Retry-After", "30");
    });

    it("turns a ZodError into VALIDATION_ERROR with the failing paths", () => {
      const zodError = new ZodError([
        {
          path: ["username"],
          message: "Required",
          code: "invalid_type",
          expected: "string",
          received: "undefined",
        },
      ]);

      errorHandler(zodError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        code: "VALIDATION_ERROR",
        message: "Validation error",
        requestId: "req-123",
        details: [{ path: "username", message: "Required" }],
      });
    });

    it("hides unexpected errors behind INTERNAL_ERROR", () => {
      errorHandler(new Error("database exploded"), mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId: "req-123",
      });
    });

    it("adds the message and stack for unexpected errors when details are exposed", () => {
      developmentErrorHandler(new Error("database exploded"), mockReq, mockRes, mockNext);
      const body = (mockRes as unknown as { body: { details: { message: string; stack: string } } })
        .body;
      expect(body.details.message).toBe("database exploded");
      expect(body.details.stack).toContain("database exploded");
    });
  });

  describe("asyncHandler", () => {
    it("calls the handler with req, res and next", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await asyncHandler(handler)(mockReq, mockRes, mockNext);
      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it("passes a rejected promise to next", async () => {
      const error = new NotFoundError("League");
      await asyncHandler(vi.fn().mockRejectedValue(error))(mockReq, mockRes, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
