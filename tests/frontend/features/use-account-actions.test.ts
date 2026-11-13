/**
 * @vitest-environment happy-dom
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountActions } from "../../../client/src/features/account/useAccountActions";

const { disconnectMutate, deleteMutate } = vi.hoisted(() => ({
  disconnectMutate: vi.fn(),
  deleteMutate: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useDisconnectYahoo: () => ({ mutateAsync: disconnectMutate }),
  useDeleteAccount: () => ({ mutateAsync: deleteMutate }),
}));

describe("useAccountActions", () => {
  beforeEach(() => {
    disconnectMutate.mockResolvedValue({ revokedAtYahoo: true });
    deleteMutate.mockResolvedValue({ revokedAtYahoo: true });
    vi.spyOn(window.location, "assign").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("disconnects Yahoo through the mutation and returns its result", async () => {
    const { result } = renderHook(() => useAccountActions());

    const returned = await result.current.disconnectYahoo();

    expect(disconnectMutate).toHaveBeenCalledOnce();
    expect(returned).toEqual({ revokedAtYahoo: true });
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("deletes the account and then leaves for the auth page", async () => {
    const { result } = renderHook(() => useAccountActions());

    const returned = await result.current.deleteAccount();

    expect(deleteMutate).toHaveBeenCalledOnce();
    expect(returned).toEqual({ revokedAtYahoo: true });
    expect(window.location.assign).toHaveBeenCalledWith("/auth");
  });
});
