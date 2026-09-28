import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "../../../server/services/yahoo/yahoo-request-policy";
import {
  refreshAccessToken,
  revokeYahooToken,
} from "../../../server/yahoo-auth";

vi.mock("axios");
vi.mock("../../../server/config/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../server/config/env")>();
  return {
    ...original,
    env: {
      ...original.env,
      YAHOO_PROVIDER_REDIRECT_URI: "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
    },
  };
});

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bounds the call and returns a rotated refresh token", async () => {
    vi.mocked(axios).mockResolvedValueOnce({
      data: { access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 },
    });

    await expect(refreshAccessToken("old-refresh", "id", "secret")).resolves.toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 3600,
    });
    const request = vi.mocked(axios).mock.calls[0][0];
    expect(request.timeout).toBe(8_000);
    expect(new URLSearchParams(request.data).get("refresh_token")).toBe("old-refresh");
  });

  it("reports an omitted refresh token as absent so the caller keeps the current one", async () => {
    vi.mocked(axios).mockResolvedValueOnce({
      data: { access_token: "new-access", expires_in: 3600 },
    });

    const result = await refreshAccessToken("old-refresh", "id", "secret");

    expect(result.refreshToken).toBeUndefined();
    expect(result.accessToken).toBe("new-access");
  });

  it("requires reconnecting when Yahoo rejects the grant", async () => {
    for (const status of [400, 401]) {
      vi.mocked(axios).mockRejectedValueOnce({
        isAxiosError: true,
        response: { status, data: { error: "invalid_grant" } },
      });

      await expect(refreshAccessToken("revoked", "id", "secret")).rejects.toBeInstanceOf(
        YahooReconnectRequiredError,
      );
    }
  });

  it("treats timeouts, 5xx and incomplete responses as an outage", async () => {
    vi.mocked(axios)
      .mockRejectedValueOnce({ isAxiosError: true, code: "ECONNABORTED" })
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
      .mockResolvedValueOnce({ data: { refresh_token: "only-refresh" } });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(refreshAccessToken("current", "id", "secret")).rejects.toBeInstanceOf(
        YahooUnavailableError,
      );
    }
  });
});

describe("revokeYahooToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms revocation only when Yahoo accepts it", async () => {
    vi.mocked(axios)
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } });

    await expect(revokeYahooToken("refresh", "id", "secret")).resolves.toBe(true);
    await expect(revokeYahooToken("refresh", "id", "secret")).resolves.toBe(false);

    const request = vi.mocked(axios).mock.calls[0][0];
    expect(request.url).toBe("https://api.login.yahoo.com/oauth2/revoke");
    expect(request.timeout).toBe(8_000);
    expect(new URLSearchParams(request.data).get("token")).toBe("refresh");
  });

  it("does not call Yahoo without a token or client credentials", async () => {
    await expect(revokeYahooToken("", "id", "secret")).resolves.toBe(false);
    await expect(revokeYahooToken("refresh", "", "secret")).resolves.toBe(false);
    expect(axios).not.toHaveBeenCalled();
  });
});
