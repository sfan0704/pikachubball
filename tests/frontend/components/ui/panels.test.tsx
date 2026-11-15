/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../../../client/src/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../../../../client/src/components/ui/sheet";

const LONG_TEXT = Array.from({ length: 40 }, (_, index) => <p key={index}>Line {index}</p>);

function renderDialog(onOpenChange: (open: boolean) => void) {
  render(
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="gap-5" data-testid="panel">
        <DialogTitle>Long dialog</DialogTitle>
        <DialogDescription>Many lines.</DialogDescription>
        {LONG_TEXT}
      </DialogContent>
    </Dialog>
  );
}

function renderSheet(onOpenChange: (open: boolean) => void) {
  render(
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="px-4" data-testid="panel">
        <SheetTitle>Long sheet</SheetTitle>
        <SheetDescription>Many lines.</SheetDescription>
        {LONG_TEXT}
      </SheetContent>
    </Sheet>
  );
}

describe.each([
  ["dialog", renderDialog, "max-h-[85dvh]"],
  ["sheet", renderSheet, "max-h-[90dvh]"],
])("a long %s", (_name, renderPanel, maxHeight) => {
  it("stays within the visible screen and scrolls its body, not the panel holding the close button", () => {
    renderPanel(vi.fn());
    const panel = screen.getByTestId("panel");
    expect(panel.className).toContain(maxHeight);
    expect(panel.className).toContain("overflow-hidden");
    expect(panel.className).not.toMatch(/\bvh\b|\d+vh\]/);

    const body = screen.getByText("Line 0").parentElement;
    expect(body?.className).toContain("overflow-y-auto");
    expect(body?.contains(screen.getByRole("button", { name: "Close" }))).toBe(false);
    expect(screen.getByRole("button", { name: "Close" }).parentElement).toBe(panel);
  });

  it("puts the caller's className on the scrolling body", () => {
    renderPanel(vi.fn());
    const body = screen.getByText("Line 0").parentElement;
    expect(body?.className).toMatch(/gap-5|px-4/);
  });

  it("closes from the close button", async () => {
    const onOpenChange = vi.fn();
    renderPanel(onOpenChange);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    renderPanel(onOpenChange);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
