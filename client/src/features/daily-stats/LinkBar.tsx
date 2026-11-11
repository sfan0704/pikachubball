import { Link } from "wouter";
import { cn } from "@/lib/utils";

/** One choice in a link bar: where it goes and whether it is what's shown. */
export interface LinkBarItem {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
}

interface LinkBarProps {
  /** Names the bar for screen readers, for example "Screens". */
  label: string;
  items: readonly LinkBarItem[];
  testId: string;
}

/**
 * A row of links styled as a segmented control. Links, not tabs, because each
 * choice is a URL: refresh, back and shared links keep it.
 */
export function LinkBar({ label, items, testId }: LinkBarProps) {
  return (
    <nav aria-label={label} data-testid={testId}>
      <ul className="flex w-full gap-1 rounded-lg bg-muted p-1">
        {items.map((item) => (
          <li key={item.key} className="flex-1">
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                item.current
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
