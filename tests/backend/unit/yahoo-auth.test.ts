import { describe, expect, it } from "vitest";
import {
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "../../../server/fantasy/yahoo/yahoo-request-policy";
import {
  exchangeAuthorizationCode,
  refreshAccessToken,
  revokeYahooToken,
} from "../../../server/fantasy/yahoo/yahoo-auth";
import { fakeFetch, jsonResponse, requestOf, timeoutError } from "../../support/fetch";

const REDIRECT_URI = "https://basketball.example.test/api/auth/yahoo/fantasy/callback";

describe("exchangeAuthorizationCode", () => {
  it("sends Yahoo client credentials in the token form as required by the legacy client", async () => {
    const fetchFunction = fakeFetch().mockResolvedValue(
      jsonResponse({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        xoauth_yahoo_guid: "yahoo-guid",
      })
    );

    await exchangeAuthorizationCode(
      "authorization-code",
      "client-id",
      "client-secret",
      REDIRECT_URI,
      fetchFunction
    );

    expect(fetchFunction).toHaveBeenCalledOnce();
    const request = requestOf(fetchFunction);
    expect(request.method).toBe("POST");
    expect(request.form.get("client_id")).toBe("client-id");
    expect(request.form.get("client_secret")).toBe("client-secret");
    expect(request.form.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(request.form.get("code")).toBe("authorization-code");
    expect(request.form.get("grant_type")).toBe("authorization_code");
  });

  it("accepts a legacy Fantasy token response that omits the guid", async () => {
    const fetchFunction = fakeFetch().mockResolvedValueOnce(
      jsonResponse({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
      })
    );

    const result = await exchangeAuthorizationCode(
      "authorization-code",
      "client-id",
      "client-secret",
      REDIRECT_URI,
      fetchFunction
    );

    expect(result.yahooGuid).toBeUndefined();
    expect(fetchFunction).toHaveBeenCalledOnce();
  });
});

describe("refreshAccessToken", () => {
  it("bounds the call and returns a rotated refresh token", async () => {
    const fetchFunction = fakeFetch().mockResolvedValueOnce(
      jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 })
    );

    await expect(
      refreshAccessToken("old-refresh", "id", "secret", REDIRECT_URI, fetchFunction)
    ).resolves.toEqual({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 3600 });
    const request = requestOf(fetchFunction);
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.form.get("refresh_token")).toBe("old-refresh");
  });

  it("reports an omitted refresh token as absent so the caller keeps the current one", async () => {
    const fetchFunction = fakeFetch().mockResolvedValueOnce(
      jsonResponse({ access_token: "new-access", expires_in: 3600 })
    );

    const result = await refreshAccessToken(
      "old-refresh",
      "id",
      "secret",
      REDIRECT_URI,
      fetchFunction
    );

    expect(result.refreshToken).toBeUndefined();
    expect(result.accessToken).toBe("new-access");
  });

  it("requires reconnecting when Yahoo rejects the grant", async () => {
    for (const status of [400, 401]) {
      const fetchFunction = fakeFetch().mockResolvedValueOnce(
        jsonResponse({ error: "invalid_grant" }, status)
      );

      await expect(
        refreshAccessToken("revoked", "id", "secret", REDIRECT_URI, fetchFunction)
      ).rejects.toBeInstanceOf(YahooReconnectRequiredError);
    }
  });

  it("treats timeouts, 5xx and incomplete responses as an outage", async () => {
    const fetchFunction = fakeFetch()
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ refresh_token: "only-refresh" }));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        refreshAccessToken("current", "id", "secret", REDIRECT_URI, fetchFunction)
      ).rejects.toBeInstanceOf(YahooUnavailableError);
    }
  });

  it("sends the provider redirect it was given and refuses to run without one", async () => {
    const fetchFunction = fakeFetch().mockResolvedValueOnce(
      jsonResponse({ access_token: "a", expires_in: 3600 })
    );
    await refreshAccessToken("refresh", "id", "secret", REDIRECT_URI, fetchFunction);
    expect(requestOf(fetchFunction).form.get("redirect_uri")).toBe(REDIRECT_URI);

    await expect(
      refreshAccessToken("refresh", "id", "secret", null, fetchFunction)
    ).rejects.toThrow("refresh configuration is incomplete");
  });
});

describe("revokeYahooToken", () => {
  it("confirms revocation only when Yahoo accepts it", async () => {
    const fetchFunction = fakeFetch()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}, 503));

    await expect(revokeYahooToken("refresh", "id", "secret", fetchFunction)).resolves.toBe(true);
    await expect(revokeYahooToken("refresh", "id", "secret", fetchFunction)).resolves.toBe(false);

    const request = requestOf(fetchFunction);
    expect(request.url).toBe("https://api.login.yahoo.com/oauth2/revoke");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.form.get("token")).toBe("refresh");
  });

  it("does not call Yahoo without a token or client credentials", async () => {
    const fetchFunction = fakeFetch();
    await expect(revokeYahooToken("", "id", "secret", fetchFunction)).resolves.toBe(false);
    await expect(revokeYahooToken("refresh", "", "secret", fetchFunction)).resolves.toBe(false);
    expect(fetchFunction).not.toHaveBeenCalled();
  });
});
