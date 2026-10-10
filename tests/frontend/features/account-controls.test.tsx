/**
 * @vitest-environment happy-dom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AccountControls,
  type AccountActions,
} from "../../../client/src/features/account/AccountControls";
import { ApiError } from "../../../client/src/api/errors";

function setup(overrides: Partial<AccountActions> = {}) {
  const actions: AccountActions = {
    signOut: vi.fn().mockResolvedValue(undefined),
    disconnectYahoo: vi.fn().mockResolvedValue({ revokedAtYahoo: true }),
    deleteAccount: vi.fn().mockResolvedValue({ revokedAtYahoo: true }),
    ...overrides,
  };
  render(<AccountControls actions={actions} />);
  return actions;
}

describe("sign out", () => {
  it("signs out straight away, without a confirmation", async () => {
    const actions = setup();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(actions.signOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("disconnect Yahoo", () => {
  it("explains what is removed and does nothing until confirmed", async () => {
    const actions = setup();

    await userEvent.click(screen.getByRole("button", { name: "Disconnect Yahoo" }));

    const dialog = screen.getByRole("alertdialog", { name: "Disconnect Yahoo?" });
    expect(dialog).toHaveTextContent("revokes this app's access at Yahoo");
    expect(dialog).toHaveTextContent("Your account stays");
    expect(actions.disconnectYahoo).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const actions = setup();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Yahoo" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(actions.disconnectYahoo).not.toHaveBeenCalled();
  });

  it("disconnects on confirmation and reports that Yahoo revoked the access", async () => {
    const actions = setup();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Yahoo" }));

    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Disconnect Yahoo" })
    );

    expect(actions.disconnectYahoo).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Yahoo disconnected. Access was revoked at Yahoo."
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("tells the user to remove the app at Yahoo when Yahoo did not confirm", async () => {
    setup({ disconnectYahoo: vi.fn().mockResolvedValue({ revokedAtYahoo: false }) });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Yahoo" }));

    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Disconnect Yahoo" })
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Yahoo did not confirm the revocation"
    );
  });

  it("shows why it failed and keeps the confirmation open to try again", async () => {
    setup({
      disconnectYahoo: vi.fn().mockRejectedValue(new ApiError("YAHOO_UNAVAILABLE", "x", 503, "r")),
    });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Yahoo" }));

    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Disconnect Yahoo" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Yahoo Fantasy isn't responding");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("delete account", () => {
  it("warns that it is permanent and lists what goes", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete your account?" });
    expect(dialog).toHaveTextContent("permanently deletes your account");
    expect(dialog).toHaveTextContent("It can't be undone");
  });

  it("deletes only after confirming, and not when cancelled", async () => {
    const actions = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(actions.deleteAccount).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(actions.deleteAccount).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Account deleted.");
  });

  it("disables the buttons while a removal is running", async () => {
    let finish: (value: { revokedAtYahoo: boolean }) => void = () => undefined;
    setup({
      deleteAccount: vi.fn(
        () => new Promise<{ revokedAtYahoo: boolean }>((resolve) => (finish = resolve))
      ),
    });
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    finish({ revokedAtYahoo: true });
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });
});
