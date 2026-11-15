/** League's two views: the standings table or the category rank grid. */
export const LEAGUE_VIEWS = ["standings", "categories"] as const;

export type LeagueView = (typeof LEAGUE_VIEWS)[number];

/** The Standings columns that sort the table: the official record, all-play rank or luck. */
export const STANDINGS_SORTS = ["record", "all-play", "luck"] as const;

export type StandingsSort = (typeof STANDINGS_SORTS)[number];

/** What League shows below the period: the view, the Standings sort and the picked category. */
export interface LeagueBoardState {
  readonly view: LeagueView;
  readonly sort: StandingsSort;
  /** The stat id of the category the grid is sorted by, or null for the standings order. */
  readonly category: string | null;
}

/** League opens on Standings in official order with no category picked. */
export const DEFAULT_BOARD: LeagueBoardState = {
  view: "standings",
  sort: "record",
  category: null,
};

const CATEGORY_ID = /^\d+$/;

function pick<T extends string>(options: readonly T[], value: string | null, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

/**
 * The board a query string asks for. An unknown value falls back to the
 * default for that part only, so an old or hand-edited link still opens League.
 */
export function parseBoard(search: string): LeagueBoardState {
  const params = new URLSearchParams(search);
  const category = params.get("category");
  return {
    view: pick(LEAGUE_VIEWS, params.get("view"), DEFAULT_BOARD.view),
    sort: pick(STANDINGS_SORTS, params.get("sort"), DEFAULT_BOARD.sort),
    category: category !== null && CATEGORY_ID.test(category) ? category : null,
  };
}

/** The query string for a board, holding only what differs from the default ("" when nothing does). */
export function boardQuery(board: LeagueBoardState): string {
  const params = new URLSearchParams();
  if (board.view !== DEFAULT_BOARD.view) {
    params.set("view", board.view);
  }
  if (board.sort !== DEFAULT_BOARD.sort) {
    params.set("sort", board.sort);
  }
  if (board.category !== null) {
    params.set("category", board.category);
  }
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}
