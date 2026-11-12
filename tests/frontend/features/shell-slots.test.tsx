/**
 * @vitest-environment happy-dom
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellSlot, ShellSlotsProvider } from "../../../client/src/features/shell/shell-slots";

describe("the header slots", () => {
  it("keeps a screen's line in place when there is no shell", () => {
    render(<ShellSlot name="freshness">Updated just now</ShellSlot>);

    expect(screen.getByText("Updated just now")).toBeInTheDocument();
  });

  it("moves a screen's line into the header's slot, and shows nothing until the slot exists", () => {
    const slot = document.createElement("div");
    document.body.append(slot);
    const { rerender } = render(
      <ShellSlotsProvider value={{ league: null, context: null, freshness: null }}>
        <ShellSlot name="freshness">Updated just now</ShellSlot>
      </ShellSlotsProvider>
    );
    expect(screen.queryByText("Updated just now")).not.toBeInTheDocument();

    rerender(
      <ShellSlotsProvider value={{ league: null, context: null, freshness: slot }}>
        <ShellSlot name="freshness">Updated just now</ShellSlot>
      </ShellSlotsProvider>
    );

    expect(within(slot).getByText("Updated just now")).toBeInTheDocument();
  });
});
