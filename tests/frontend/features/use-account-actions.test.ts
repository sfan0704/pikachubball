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

  it("disconnects Yahoo and then leaves for the sign-in page with the result", async () => {
    const { result } = renderHook(() => useAccountActions());

    const returned = await result.current.disconnectYahoo();

    expect(disconnectMutate).toHaveBeenCalledOnce();
    expect(returned).toEqual({ revokedAtYahoo: true });
    expect(window.location.assign).toHaveBeenCalledWith("/auth?removed=disconnect&revoked=true");
  });

  it("deletes the account and then leaves for the sign-in page with the result", async () => {
    deleteMutate.mockResolvedValue({ revokedAtYahoo: false });
    const { result } = renderHook(() => useAccountActions());

    const returned = await result.current.deleteAccount();

    expect(deleteMutate).toHaveBeenCalledOnce();
    expect(returned).toEqual({ revokedAtYahoo: false });
    expect(window.location.assign).toHaveBeenCalledWith("/auth?removed=delete&revoked=false");
  });

  it("stays on the page when the disconnect fails", async () => {
    disconnectMutate.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAccountActions());

    await expect(result.current.disconnectYahoo()).rejects.toThrow("offline");

    expect(window.location.assign).not.toHaveBeenCalled();
  });
});
