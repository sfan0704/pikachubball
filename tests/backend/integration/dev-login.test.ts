import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApp } from "../../../server/http/app";
import { createAppErrorHandler } from "../../../server/http/composition-root";
import { buildTestConfig, buildTestDependencies } from "../../support/dependencies";

function app(localStack: boolean, signIn = vi.fn().mockResolvedValue({ error: null })) {
  const dependencies = buildTestDependencies({
    config: buildTestConfig({ localStack }),
    createSupabaseClient: () =>
      ({ auth: { signInWithPassword: signIn } }) as unknown as SupabaseClient,
  });
  const application = createApp(dependencies);
  application.use(createAppErrorHandler(dependencies));
  return { application, signIn };
}

describe("the local sign-in shortcut", () => {
  it("does not exist outside local-stack mode", async () => {
    const { application, signIn } = app(false);

    const response = await request(application).get("/api/dev/login?user=a");

    expect(response.status).toBe(404);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in a seeded manager and goes to the app in local-stack mode", async () => {
    const { application, signIn } = app(true);

    const response = await request(application).get("/api/dev/login?user=b");

    expect(response.status).toBe(303);
    expect(response.headers.location).toBe("/");
    expect(signIn).toHaveBeenCalledWith({
      email: "manager-b@example.test",
      password: "local-only-password-b",
    });
  });

  it("knows only the seeded managers, and says when the seed hasn't run", async () => {
    const unknown = await request(app(true).application).get("/api/dev/login?user=zed");
    const failed = await request(
      app(true, vi.fn().mockResolvedValue({ error: new Error("invalid login") })).application
    ).get("/api/dev/login?user=a");

    expect(unknown.status).toBe(404);
    expect(failed.status).toBe(401);
  });
});
