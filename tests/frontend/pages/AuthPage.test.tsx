/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "../../../client/src/pages/AuthPage";

describe("AuthPage", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/auth");
    vi.restoreAllMocks();
  });

  it("renders Yahoo as the only sign-in method", () => {
    render(<AuthPage />);

    expect(screen.getByText("Yahoo Fantasy Basketball")).toBeInTheDocument();
    expect(screen.getByTestId("button-yahoo-login")).toHaveTextContent("Continue with Yahoo");
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.queryByText(/admin login/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("starts the server-owned Yahoo flow", async () => {
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<AuthPage />);

    await userEvent.setup().click(screen.getByTestId("button-yahoo-login"));

    expect(assign).toHaveBeenCalledWith("/api/auth/yahoo");
  });

  it("says nothing about a removal on a plain visit", () => {
    render(<AuthPage />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports a disconnect that Yahoo confirmed", () => {
    window.history.replaceState(null, "", "/auth?removed=disconnect&revoked=true");
    render(<AuthPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Yahoo disconnected. Access was revoked at Yahoo."
    );
  });

  it("reports an account deletion that Yahoo did not confirm", () => {
    window.history.replaceState(null, "", "/auth?removed=delete&revoked=false");
    render(<AuthPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Account deleted. Yahoo did not confirm the revocation"
    );
  });

  it("ignores a malformed removal report", () => {
    for (const search of ["?removed=other&revoked=true", "?removed=delete&revoked=maybe"]) {
      window.history.replaceState(null, "", `/auth${search}`);
      const { unmount } = render(<AuthPage />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      unmount();
    }
  });
});
