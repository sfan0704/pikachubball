import request from "supertest";
import { describe, expect, it } from "vitest";
import { syntheticAuth } from "../../support/synthetic-auth";

function cookieHeader(headers: Record<string, unknown>): string {
  const cookies = headers["set-cookie"];
  return Array.isArray(cookies)
    ? cookies.map((value) => String(value).split(";")[0]).join("; ")
    : "";
}

describe("real Express/SSR SDK callback isolation over synthetic Auth", () => {
  it("rejects browser B's use of A's code and permits the owning browser", async () => {
    const flow = syntheticAuth();
    const server = flow.app();
    const a = request.agent(server);
    const b = request.agent(server);
    const startA = await a.get("/start");
    await b.get("/start");
    const callback = flow.issue(String(startA.headers.location), "code-a");

    expect((await b.get(callback)).status).toBe(401);
    expect((await b.get("/protected")).status).toBe(401);
    expect(flow.save).not.toHaveBeenCalled();
    const accepted = await a.get(callback);
    expect(accepted.status).toBe(303);
    expect((await a.get("/protected")).status).toBe(200);
    expect(flow.save).toHaveBeenCalledTimes(1);
    expect((await a.get(callback)).status).toBe(401);
    expect(flow.save).toHaveBeenCalledTimes(1);
  });

  it("reads the same authenticated cookies in a cold app and clears the jar on logout", async () => {
    const flow = syntheticAuth();
    const browser = request.agent(flow.app());
    const start = await browser.get("/start");
    const accepted = await browser.get(flow.issue(String(start.headers.location), "cold-code"));
    expect(accepted.status).toBe(303);
    const cold = await request(flow.app())
      .get("/protected")
      .set("Cookie", cookieHeader(accepted.headers));
    expect(cold.status).toBe(200);
    expect(cold.body).toEqual({ userId: "23f99d06-30ff-4767-8c41-21510b7fd5d0" });
    expect((await browser.post("/logout")).status).toBe(200);
    expect((await browser.get("/protected")).status).toBe(401);
    // The synthetic Auth user endpoint still accepts the unexpired JWT.
    // A fresh app must reject it because logout removed its backing session.
    expect(
      (await request(flow.app()).get("/protected").set("Cookie", cookieHeader(accepted.headers)))
        .status
    ).toBe(401);
  });

  it("does not leave an authenticated browser after a rejected provider-token handoff", async () => {
    const flow = syntheticAuth();
    const browser = request.agent(flow.app());
    const start = await browser.get("/start");
    const rejected = await browser.get(
      flow.issue(String(start.headers.location), "incomplete-code", true)
    );
    expect(rejected.status).toBe(401);
    expect(flow.save).not.toHaveBeenCalled();
    expect((await browser.get("/protected")).status).toBe(401);
  });
});
