import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { clearAuthSessionCookies } from "../../../../server/http/auth/supabase-auth";
import { buildTestConfig } from "../../../support/dependencies";

describe("rejected callback session cookies", () => {
  it("expires incoming/new session chunks while preserving PKCE cleanup and unrelated cookies", async () => {
    const app = express();
    app.get("/rejected", (req, res) => {
      res.setHeader("Set-Cookie", [
        "pikachubball-auth.0=new; Path=/",
        "pikachubball-auth-user=new; Path=/",
        "pikachubball-auth-code-verifier=; Max-Age=0; Path=/",
        "theme=dark; Path=/",
      ]);
      clearAuthSessionCookies(req, res, { ...buildTestConfig().auth, secureCookies: true });
      res.sendStatus(401);
    });
    const response = await request(app)
      .get("/rejected")
      .set("Cookie", "pikachubball-auth.1=old; theme=dark");
    const headers = response.headers["set-cookie"] as string[];
    expect(headers).toContain("theme=dark; Path=/");
    expect(headers).toContain("pikachubball-auth-code-verifier=; Max-Age=0; Path=/");
    const sessions = headers.filter(
      (value) => !value.startsWith("theme=") && !value.includes("code-verifier")
    );
    expect(sessions).toHaveLength(3);
    for (const cookie of sessions) {
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).not.toContain("=new");
    }
  });
});
