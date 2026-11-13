/**
 * @vitest-environment happy-dom
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../client/src/App";

const authState = vi.hoisted(() => ({
  user: null as { id: string; displayName: string | null; email: string | null } | null,
  isLoading: false,
}));

vi.mock("@/lib/auth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: authState.user,
    isLoading: authState.isLoading,
    logout: async () => {},
  }),
}));

vi.mock("@/pages/LeaguePage", () => ({ default: () => <div>league-page</div> }));
vi.mock("@/pages/AuthPage", () => ({ default: () => <div>auth-page</div> }));
vi.mock("@/pages/NotFoundPage", () => ({ default: () => <div>not-found-page</div> }));

const signedIn = { id: "user-1", displayName: "Manager", email: null };

function renderApp(url: string) {
  window.history.pushState({}, "", url);
  return render(<App />);
}

describe("App routing", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
  });

  it("shows loading skeletons while the session is being read", () => {
    authState.isLoading = true;

    const { container } = renderApp("/");

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("league-page")).not.toBeInTheDocument();
  });

  it("sends an unauthenticated visitor from / to the auth page", async () => {
    renderApp("/");

    expect(await screen.findByText("auth-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
  });

  it("shows the league page to a signed-in visitor at /", () => {
    authState.user = signedIn;

    renderApp("/");

    expect(screen.getByText("league-page")).toBeInTheDocument();
  });

  it("shows the auth page to an unauthenticated visitor at /auth", () => {
    renderApp("/auth");

    expect(screen.getByText("auth-page")).toBeInTheDocument();
  });

  it("sends a signed-in visitor from /auth back to the league page", async () => {
    authState.user = signedIn;

    renderApp("/auth");

    expect(await screen.findByText("league-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it.each([
    "/leagues/466.l.1/teams/466.l.1.t.1/players",
    "/leagues/466.l.1/teams/466.l.1.t.1/matchup/2026-11-13",
    "/leagues/466.l.1/teams/466.l.1.t.1/matchup/week/3",
  ])("shows the league page for a signed-in visitor at %s", (url) => {
    authState.user = signedIn;

    renderApp(url);

    expect(screen.getByText("league-page")).toBeInTheDocument();
  });

  it("sends an unauthenticated visitor from a league route to the auth page", async () => {
    renderApp("/leagues/466.l.1/teams/466.l.1.t.1/players");

    expect(await screen.findByText("auth-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
  });

  it("shows the not-found page for an unknown route", () => {
    authState.user = signedIn;

    renderApp("/nope");

    expect(screen.getByText("not-found-page")).toBeInTheDocument();
  });
});

// Note: ProtectedRoute's own loading branch is unreachable — Router already
// returns the loading skeletons before any route renders — so no test here
// can cover it. Removing that branch is a production-code decision, left
// out of this test-only change.
