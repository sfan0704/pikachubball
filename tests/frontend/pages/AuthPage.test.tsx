/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "../../../client/src/pages/AuthPage";

describe("AuthPage", () => {
  it("renders Yahoo as the only sign-in method", () => {
    render(<AuthPage />);

    expect(screen.getByText("Yahoo Fantasy Basketball")).toBeInTheDocument();
    expect(screen.getByTestId("button-yahoo-login")).toHaveTextContent(
      "Continue with Yahoo",
    );
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
});
