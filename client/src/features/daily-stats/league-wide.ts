import { useEffect, useRef, type RefObject } from "react";

/** A table card's heading on a wide screen, where both tables show and no Standings | Categories bar names them. */
export const CARD_HEADING_CLASS =
  "px-1 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-[#4B5563] dark:text-muted-foreground";

/**
 * The dark outline round the picked team's row on a wide screen. It sits a
 * little outside the row, in the card's padding, so it never covers a number,
 * and above the sticky team column. A scroll stops it below the sticky header.
 */
export const PICKED_ROW_CLASS =
  "relative scroll-mt-(--app-header-height) after:pointer-events-none after:absolute after:inset-y-0 after:-inset-x-1.5 after:z-20 after:rounded-[10px] after:border-2 after:border-[#15181D] dark:after:border-white";

/** The row's aria-selected: left out on a phone, where no team is picked on the page. */
export function pickedState(pickedTeamKey: string | null, teamKey: string): boolean | undefined {
  return pickedTeamKey === null ? undefined : teamKey === pickedTeamKey;
}

/**
 * Scrolls the picked row back into view when the table's order changes, so a
 * sort never loses it. Not on first render: opening League keeps the page at the top.
 */
export function useKeepInView(row: RefObject<HTMLElement | null>, order: string): void {
  const shown = useRef(order);
  useEffect(() => {
    if (shown.current === order) {
      return;
    }
    shown.current = order;
    row.current?.scrollIntoView({ block: "nearest" });
  }, [row, order]);
}
