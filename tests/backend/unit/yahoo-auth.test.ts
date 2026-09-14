import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeAuthorizationCode } from "../../../server/yahoo-auth";

vi.mock("axios");

describe("exchangeAuthorizationCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends Yahoo client credentials in the token form as required by the legacy client", async () => {
    vi.mocked(axios).mockResolvedValue({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        xoauth_yahoo_guid: "yahoo-guid",
      },
    });

    await exchangeAuthorizationCode(
      "authorization-code",
      "client-id",
      "client-secret",
      "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
    );

    expect(axios).toHaveBeenCalledOnce();
    const request = vi.mocked(axios).mock.calls[0][0];
    const body = new URLSearchParams(request.data);
    expect(body.get("client_id")).toBe("client-id");
    expect(body.get("client_secret")).toBe("client-secret");
    expect(body.get("redirect_uri")).toBe(
      "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
    );
    expect(body.get("code")).toBe("authorization-code");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("accepts a legacy Fantasy token response that omits the guid", async () => {
    vi.mocked(axios).mockResolvedValueOnce({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
      },
    });

    const result = await exchangeAuthorizationCode(
      "authorization-code",
      "client-id",
      "client-secret",
      "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
    );

    expect(result.yahooGuid).toBeUndefined();
    expect(axios).toHaveBeenCalledOnce();
  });
});
