import { cn } from "@/lib/utils";

const SEARCH_MAX_LENGTH = 40;

/** The search box, with a magnifier, as tall as the Filters button beside it. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex min-h-[42px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-input bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="shrink-0 text-muted-foreground"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span className="sr-only">Search players</span>
      <input
        type="search"
        value={value}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Search players"
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-hidden"
      />
    </label>
  );
}

/** The Filters button: an icon with a count badge while any sheet filter is on. */
function FiltersButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={count === 0 ? "Filters" : `Filters, ${count} on`}
      className={cn(
        "relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-background",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        count === 0 ? "border border-input" : "border-2 border-foreground"
      )}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
      </svg>
      {count > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground text-[0.625rem] font-bold text-background"
          data-testid="filters-badge"
          aria-hidden
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface PlayersToolbarProps {
  searchText: string;
  onSearch: (text: string) => void;
  filterCount: number;
  onOpenFilters: () => void;
}

/** The top row of Players: search, then the Filters button. */
export function PlayersToolbar({
  searchText,
  onSearch,
  filterCount,
  onOpenFilters,
}: PlayersToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <SearchBox value={searchText} onChange={onSearch} />
      <FiltersButton count={filterCount} onOpen={onOpenFilters} />
    </div>
  );
}
