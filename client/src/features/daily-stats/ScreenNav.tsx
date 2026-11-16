import { Link } from "wouter";
import { SCREEN_LABELS, type Screen } from "@/features/league/screens";
import { openScreen, selectionPath, type Selection } from "@/features/league/selection";
import { ShellSlot } from "@/features/shell/shell-slots";
import { cn } from "@/lib/utils";

/** The tab icons, drawn as in the FAN-88 mockup. */
const ICON_PATHS: Readonly<Record<Screen, readonly string[]>> = {
  matchup: ["M4 20V10M10 20V4M16 20v-7M22 20H2"],
  players: ["M2 21c0-4 3-7 7-7s7 3 7 7M17 11h6M20 8v6"],
  league: ["M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 6h3v2a3 3 0 01-3 3M7 6H4v2a3 3 0 003 3"],
};

function TabIcon({ screen }: { screen: Screen }) {
  return (
    <svg
      className="size-[22px] md:size-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {screen === "players" && <circle cx="9" cy="8" r="4" />}
      {ICON_PATHS[screen].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

/**
 * The screen tabs: Matchup, Players and League, for the screens the server has
 * wired. One list placed by CSS: a bar fixed to the bottom on a phone, tabs in
 * the header's bar from the md breakpoint. Links, not tabs, because each
 * screen is a URL: refresh, back and shared links keep it.
 */
export function ScreenNav({
  selection,
  screens,
}: {
  selection: Selection;
  screens: readonly Screen[];
}) {
  return (
    <ShellSlot name="nav">
      <nav
        aria-label="Screens"
        data-testid="screen-nav"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[max(18px,env(safe-area-inset-bottom))]",
          "md:static md:shrink-0 md:self-stretch md:border-0 md:bg-transparent md:pb-0"
        )}
      >
        <ul className="grid auto-cols-[minmax(0,1fr)] grid-flow-col px-2 pt-1.5 md:h-full md:auto-cols-auto md:gap-1 md:p-0">
          {screens.map((screen) => {
            const current = selection.screen === screen;
            return (
              <li key={screen}>
                <Link
                  href={selectionPath(openScreen(selection, screen))}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-semibold",
                    "md:relative md:h-full md:flex-row md:gap-2 md:px-2 md:text-sm lg:px-3.5 md:hover:text-foreground",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    current ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-[3px] w-[22px] rounded-full",
                      "md:absolute md:inset-x-0 md:bottom-0 md:w-auto md:rounded-none",
                      current && "bg-[#F5C518]"
                    )}
                  />
                  <TabIcon screen={screen} />
                  {SCREEN_LABELS[screen]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </ShellSlot>
  );
}
