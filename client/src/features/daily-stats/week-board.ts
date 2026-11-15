/**
 * Puts the Week view together: each team's days joined into player weeks and
 * the counted team totals, and the text each card shows. The counting rules
 * live in shared/domain; this only joins and formats.
 */
import type { TeamDayResponse, WeeksResponse } from "@shared/api/daily-stats";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import {
  addDays,
  countedGamesLabel,
  countedTotals,
  weekParts,
  weekPlayers,
  weekValue,
  type LeagueCategory,
  type PlayerDay,
  type StatTotals,
  type WeekBounds,
  type WeekPlayer,
} from "@shared/domain";
import type { LeagueScope } from "@shared/api/league-scope";
import { boardValueText } from "./matchup-board";

/** One scoring week as D10 gives it. */
export type ScoringWeek = WeeksResponse["weeks"][number];

/** One player's week with who they are. */
export interface WeekCard extends WeekPlayer {
  readonly player: DailyPlayer;
}

/** One team's week: its player cards in roster order and the totals that counted, by stat id. */
export interface TeamWeek {
  readonly cards: readonly WeekCard[];
  readonly totals: StatTotals;
}

/** The week a scope names: the one holding today for "current", else that week number. */
export function weekFor(
  weeks: readonly ScoringWeek[],
  scope: LeagueScope,
  today: string
): ScoringWeek | undefined {
  return scope === "current"
    ? weeks.find(({ start, end }) => start <= today && today <= end)
    : weeks.find(({ week }) => week === scope);
}

/** Whether a player counts as out right now: in an IL slot, or out by Yahoo's designation today. */
function isOutNow(entry: TeamDayResponse["players"][number], isCurrentWeek: boolean): boolean {
  return entry.slot === "IL" || (isCurrentWeek && entry.player.injuryToday?.designation === "O");
}

/** A team's shown days, in date order, joined into player weeks and counted totals. */
export function teamWeek(
  days: readonly TeamDayResponse[],
  bounds: WeekBounds,
  isCurrentWeek: boolean,
  categories: readonly LeagueCategory[]
): TeamWeek {
  const playerDays: PlayerDay[] = days.flatMap((day) =>
    day.players.map(({ player, slot, isStartingSlot, line }) => ({
      playerKey: player.playerKey,
      date: day.date,
      slot,
      isStartingSlot,
      line,
    }))
  );
  // The latest day names each player as they are now.
  const players = new Map(days.flatMap((day) => day.players.map((e) => [e.player.playerKey, e])));
  const last = days.at(-1)?.players ?? [];
  const outNow = new Set(
    last.filter((entry) => isOutNow(entry, isCurrentWeek)).map((e) => e.player.playerKey)
  );
  const cards = weekPlayers(playerDays, bounds, outNow, categories).flatMap((week) => {
    const entry = players.get(week.playerKey);
    return entry ? [{ ...week, player: entry.player }] : [];
  });
  return { cards, totals: countedTotals(playerDays, categories) };
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function at(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** "Week 4 · Nov 2–8", for the week picker. */
export function weekLabel({ week, start, end }: ScoringWeek): string {
  const [from, to] = [MONTH_DAY.format(at(start)), MONTH_DAY.format(at(end))];
  const sameMonth = from.split(" ")[0] === to.split(" ")[0];
  return `Week ${week} · ${from}–${sameMonth ? to.split(" ")[1] : to}`;
}

/** The card's value: the counted total as the board prints it, "–" when nothing counted. */
export function weekValueText(card: WeekPlayer, category: LeagueCategory): string {
  return boardValueText(category, weekValue(card, category));
}

/** A ratio's counted parts under the value ("12/25"); null for counting categories or when nothing counted. */
export function weekPartsText(card: WeekPlayer, category: LeagueCategory): string | null {
  const parts = weekParts(card, category);
  return parts === null ? null : `${parts.top}/${parts.bottom}`;
}

/**
 * The line under the name: when the player joined or left, then how their
 * games counted ("Benched", "1 of 2 G counted"), else the games that counted.
 */
export function weekMetaText(card: WeekPlayer): string {
  const moves = [
    card.addedOn === null ? null : `Added ${WEEKDAY.format(at(card.addedOn))}`,
    card.droppedAfter === null
      ? null
      : `Dropped ${WEEKDAY.format(at(addDays(card.droppedAfter, 1)))}`,
  ];
  const games = card.games === 0 ? "No games" : `${card.countedGames} G`;
  return [...moves, countedGamesLabel(card) ?? games]
    .filter((part): part is string => part !== null)
    .join(" · ");
}
