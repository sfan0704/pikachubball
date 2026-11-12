import { Link } from "wouter";
import { SCREEN_LABELS, type Screen } from "@/features/league/screens";
import { openScreen, selectionPath, type Selection } from "@/features/league/selection";
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
      width="22"
      height="22"
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
 * The bottom tab bar: Matchup, Players and League, for the screens the server
 * has wired. Links, not tabs, because each screen is a URL: refresh, back and
 * shared links keep it.
 */
export function ScreenNav({
  selection,
  screens,
}: {
  selection: Selection;
  screens: readonly Screen[];
}) {
  return (
    <nav
      aria-label="Screens"
      data-testid="screen-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[max(18px,env(safe-area-inset-bottom))]"
    >
      <ul
        className="container mx-auto grid px-2 pt-1.5"
        style={{ gridTemplateColumns: `repeat(${screens.length}, minmax(0, 1fr))` }}
      >
        {screens.map((screen) => {
          const current = selection.screen === screen;
          return (
            <li key={screen}>
              <Link
                href={selectionPath(openScreen(selection, screen))}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-semibold",
                  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  current ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-[3px] w-[22px] rounded-full", current && "bg-[#F5C518]")}
                />
                <TabIcon screen={screen} />
                {SCREEN_LABELS[screen]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
