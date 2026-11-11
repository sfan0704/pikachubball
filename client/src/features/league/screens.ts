import type { Features } from "@shared/api/account";

/** The three daily-stats screens; League holds the rankings and the views built on them. */
export type Screen = "matchup" | "players" | "league";

/** Which day Matchup shows. */
export const MATCHUP_DAYS = ["today", "yesterday", "week"] as const;

export type MatchupDay = (typeof MATCHUP_DAYS)[number];

/** The screens this server has wired, in navigation order. League is always there. */
export function availableScreens(features: Features): readonly Screen[] {
  return [
    ...(features.matchupAndLeague ? (["matchup"] as const) : []),
    ...(features.players ? (["players"] as const) : []),
    "league",
  ];
}

/** Where a new visit opens: Matchup when it is wired, else League. */
export function openingScreen(screens: readonly Screen[]): Screen {
  return screens.includes("matchup") ? "matchup" : "league";
}

/** The screen names as the navigation shows them. */
export const SCREEN_LABELS: Readonly<Record<Screen, string>> = {
  matchup: "Matchup",
  players: "Players",
  league: "League",
};

/** The Matchup day names as the day bar shows them. */
export const DAY_LABELS: Readonly<Record<MatchupDay, string>> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Week",
};
