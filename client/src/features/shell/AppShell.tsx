import { useMemo, useState, type ReactNode } from "react";
import { AccountMenu } from "@/features/account/AccountMenu";
import { ShellSlotsProvider } from "./shell-slots";

/**
 * The frame of every signed-in page, as in the FAN-88 mockup: a compact
 * sticky header (league switcher, the period shown, Account; then the
 * freshness line) above the screen. Screens fill the header's slots through
 * ShellSlot and render the bottom tab bar themselves.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState<HTMLElement | null>(null);
  const [context, setContext] = useState<HTMLElement | null>(null);
  const [freshness, setFreshness] = useState<HTMLElement | null>(null);
  const slots = useMemo(() => ({ league, context, freshness }), [league, context, freshness]);
  return (
    <ShellSlotsProvider value={slots}>
      <div className="min-h-screen bg-background">
        <header
          className="sticky top-0 z-30 h-(--app-header-height) border-b border-border bg-card"
          data-testid="app-header"
        >
          <div className="container mx-auto flex flex-col gap-1 px-4 pt-3 pb-2 md:px-6">
            <div className="flex h-8 items-center gap-2">
              <div ref={setLeague} className="min-w-0 flex-1" />
              <div
                ref={setContext}
                className="shrink-0 text-xs text-muted-foreground"
                data-testid="header-context"
              />
              <AccountMenu />
            </div>
            <div ref={setFreshness} className="h-4 min-w-0 overflow-hidden" />
          </div>
        </header>
        <main className="container mx-auto px-4 pt-4 pb-28 md:px-6">{children}</main>
      </div>
    </ShellSlotsProvider>
  );
}
