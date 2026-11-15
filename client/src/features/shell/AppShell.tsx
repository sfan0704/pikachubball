import { useMemo, useState, type ReactNode } from "react";
import { AccountMenu } from "@/features/account/AccountMenu";
import { ShellSlotsProvider } from "./shell-slots";

/**
 * The frame of every signed-in page. On a phone (FAN-88 mockup) the sticky
 * header has two rows, league, period and Account over the freshness line,
 * and the tab bar sits at the bottom. From the md breakpoint (FAN-129 mockup)
 * the header is one bar: league, tabs, then freshness, period and Account.
 * It is one header either way: the same slots, rearranged by CSS, so the DOM
 * order is the wide bar's reading order. Screens fill the slots through
 * ShellSlot.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState<HTMLElement | null>(null);
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const [freshness, setFreshness] = useState<HTMLElement | null>(null);
  const [context, setContext] = useState<HTMLElement | null>(null);
  const slots = useMemo(
    () => ({ league, nav, freshness, context }),
    [league, nav, freshness, context]
  );
  return (
    <ShellSlotsProvider value={slots}>
      <div className="min-h-screen bg-background">
        <header
          className="sticky top-0 z-30 h-(--app-header-height) border-b border-border bg-card"
          data-testid="app-header"
        >
          <div className="mx-auto grid max-w-page grid-cols-[minmax(0,1fr)_auto_auto] grid-rows-[2rem_1rem] items-center gap-x-2 gap-y-1 px-4 pt-3 pb-2 md:flex md:h-full md:gap-x-3.5 md:px-8 md:py-0">
            <div ref={setLeague} className="col-start-1 row-start-1 min-w-0 md:mr-3.5" />
            <div ref={setNav} className="contents" />
            <div
              ref={setFreshness}
              className="col-span-3 row-start-2 h-4 min-w-0 overflow-hidden md:ml-auto md:h-auto md:max-h-full"
            />
            <div
              ref={setContext}
              className="col-start-2 row-start-1 shrink-0 text-xs text-muted-foreground md:text-[13px] md:font-semibold"
              data-testid="header-context"
            />
            <div className="col-start-3 row-start-1 shrink-0">
              <AccountMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-page px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-12">
          {children}
        </main>
      </div>
    </ShellSlotsProvider>
  );
}
