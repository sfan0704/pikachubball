import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The places in the app header that a screen fills: the league, the period it shows, and how fresh it is. */
export type ShellSlotName = "league" | "context" | "freshness";

/** The header's slot elements; null until the header has mounted. */
export type ShellSlotElements = Readonly<Record<ShellSlotName, HTMLElement | null>>;

const ShellSlotsContext = createContext<ShellSlotElements | null>(null);

/** Provides the header's slot elements to the screens below it. */
export const ShellSlotsProvider = ShellSlotsContext.Provider;

/**
 * Shows its children in one of the header's slots. Without a shell (a screen
 * rendered on its own) the children stay where they are, so nothing is lost.
 */
export function ShellSlot({ name, children }: { name: ShellSlotName; children: ReactNode }) {
  const slots = useContext(ShellSlotsContext);
  if (slots === null) {
    return <>{children}</>;
  }
  const target = slots[name];
  return target === null ? null : createPortal(children, target);
}
