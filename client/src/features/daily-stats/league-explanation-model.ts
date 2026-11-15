import {
  luckSteps,
  resultsPlayed,
  winPercentage,
  winPercentageRanks,
  type AllPlayTable,
  type LuckSteps,
  type TeamRecord,
  type TeamTable,
} from "@shared/domain";
import { categoryLabel, UNAVAILABLE } from "@/features/league/categories";
import { teamCells } from "./league-board-model";
import { luckText, officialRecords, ordinal, recordText } from "./league-standings-model";

/** One box of the team sheet's strip: Standing, All-play or Luck. */
export interface SummaryItem {
  readonly label: "Standing" | "All-play" | "Luck";
  /** The place as an ordinal, or the signed luck; a dash when unknown. */
  readonly value: string;
  /** The record behind the place, or what luck is counted in. */
  readonly detail: string;
}

/** One line of the luck worked out: what it is, how it is counted, and the number. */
export interface LuckLine {
  readonly label: "Real wins" | "Expected" | "Luck";
  readonly how: string;
  readonly value: string;
}

/** One category of a team's all-play: the category and its W–L–T against every team. */
export interface AllPlayCell {
  readonly statId: string;
  readonly label: string;
  readonly record: string;
}

/** One term in the ⓘ: a plain sentence, then the viewer's own numbers when they are known. */
export interface ExplanationItem {
  readonly term: "W–L–T" | "All-play" | "Luck" | "Categories";
  readonly text: string;
  readonly yours: string | null;
}

/** One decimal, as the luck maths shows each step ("14.5"). */
function oneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** A win % with one decimal ("54.3%"). */
function percentText(share: number): string {
  return `${(Math.round(share * 1000) / 10).toFixed(1)}%`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function placeText(place: number | null | undefined): string {
  return place === null || place === undefined ? UNAVAILABLE : ordinal(place);
}

/** The places by all-play win %, keyed by team key. */
function allPlayPlaces(allPlay: AllPlayTable): Readonly<Record<string, number | null>> {
  return winPercentageRanks(
    Object.fromEntries(Object.entries(allPlay).map(([teamKey, record]) => [teamKey, record.total]))
  );
}

/** A team's luck from its official record and all-play; null when either is unknown. */
function teamLuck(
  official: TeamRecord | undefined,
  allPlay: AllPlayTable | null,
  teamKey: string
): LuckSteps | null {
  const strength = allPlay?.[teamKey];
  return official === undefined || strength === undefined
    ? null
    : luckSteps(official, strength.total);
}

/** What the luck maths shows for a team: its record, the steps and its all-play %. */
interface LuckParts {
  readonly official: TeamRecord;
  readonly steps: LuckSteps;
  readonly share: number;
}

function luckParts(
  table: TeamTable,
  allPlay: AllPlayTable | null,
  teamKey: string
): LuckParts | null {
  const official = officialRecords(table)[teamKey];
  const strength = allPlay?.[teamKey];
  const steps = teamLuck(official, allPlay, teamKey);
  const share = strength === undefined ? null : winPercentage(strength.total);
  return official === undefined || steps === null || share === null
    ? null
    : { official, steps, share };
}

/**
 * The strip at the top of a team sheet: its official place and record, its
 * all-play place and record, and its luck. Pass a null all-play while it
 * loads; those two boxes then read as a dash.
 */
export function teamSummary(
  table: TeamTable,
  allPlay: AllPlayTable | null,
  teamKey: string
): SummaryItem[] {
  const official = officialRecords(table);
  const luck = teamLuck(official[teamKey], allPlay, teamKey);
  const strength = allPlay?.[teamKey];
  return [
    {
      label: "Standing",
      value: placeText(winPercentageRanks(official)[teamKey]),
      detail: recordText(official[teamKey]),
    },
    {
      label: "All-play",
      value: allPlay === null ? UNAVAILABLE : placeText(allPlayPlaces(allPlay)[teamKey]),
      detail: recordText(strength?.total),
    },
    {
      label: "Luck",
      value: luck === null ? UNAVAILABLE : luckText(luck.luck),
      detail: "category wins",
    },
  ];
}

/**
 * A team's luck worked out step by step with its own numbers: real wins (a
 * tie as half), expected wins (all-play % × categories played), then luck.
 * Null when the team has no official record or no all-play results.
 */
export function luckLines(
  table: TeamTable,
  allPlay: AllPlayTable | null,
  teamKey: string
): LuckLine[] | null {
  const parts = luckParts(table, allPlay, teamKey);
  if (parts === null) {
    return null;
  }
  const { official, steps, share } = parts;
  return [
    {
      label: "Real wins",
      how: `${official.wins} won + ${plural(official.ties, "tie", "ties")} as half`,
      value: oneDecimal(steps.realWins),
    },
    {
      label: "Expected",
      how: `${percentText(share)} all-play × ${plural(resultsPlayed(official), "category", "categories")}`,
      value: oneDecimal(steps.expectedWins),
    },
    {
      label: "Luck",
      how: steps.luck >= 0 ? "the schedule helped" : "the schedule hurt",
      value: luckText(steps.luck),
    },
  ];
}

/**
 * Whether the sheet lists all-play category by category: only for periods
 * longer than one week, since within a week it says what the ranks already say.
 */
export function showsCategoryAllPlay(table: TeamTable): boolean {
  return table.scope.kind === "season" && table.settings.currentWeek > table.settings.startWeek;
}

/** A team's all-play W–L–T in each of the league's categories, in the league's order. */
export function allPlayCells(
  table: TeamTable,
  allPlay: AllPlayTable | null,
  teamKey: string
): AllPlayCell[] {
  const byCategory = allPlay?.[teamKey]?.byCategory;
  return table.settings.categories.map((category) => ({
    statId: category.statId,
    label: categoryLabel(category),
    record: recordText(byCategory?.[category.statId]),
  }));
}

function recordLine(table: TeamTable, teamKey: string): string | null {
  const official = officialRecords(table);
  const record = official[teamKey];
  if (record === undefined) {
    return null;
  }
  const place = placeText(winPercentageRanks(official)[teamKey]);
  return `You: ${recordText(record)} from ${plural(resultsPlayed(record), "category", "categories")}. That puts you ${place}.`;
}

function allPlayLine(allPlay: AllPlayTable | null, teamKey: string): string | null {
  const total = allPlay?.[teamKey]?.total;
  const share = total === undefined ? null : winPercentage(total);
  if (allPlay === null || total === undefined || share === null) {
    return null;
  }
  const place = placeText(allPlayPlaces(allPlay)[teamKey]);
  return `You: ${recordText(total)} from ${plural(resultsPlayed(total), "category", "categories")} (${percentText(share)}), ${place} in the league.`;
}

function luckLine(table: TeamTable, allPlay: AllPlayTable | null, teamKey: string): string | null {
  const parts = luckParts(table, allPlay, teamKey);
  if (parts === null) {
    return null;
  }
  const { official, steps, share } = parts;
  return `You: ${oneDecimal(steps.realWins)} real − ${oneDecimal(steps.expectedWins)} expected (${percentText(share)} × ${resultsPlayed(official)}) = ${luckText(steps.luck)}.`;
}

function categoriesLine(table: TeamTable, teamKey: string): string | null {
  const best = teamCells(table, teamKey)
    .flatMap((cell) => (cell.rank === null ? [] : [{ label: cell.label, rank: cell.rank }]))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 2);
  if (best.length === 0) {
    return null;
  }
  return `Your best: ${best.map((cell) => `${cell.label} (${ordinal(cell.rank)})`).join(", ")}.`;
}

/**
 * The ⓘ: W–L–T, All-play, Luck and Categories, each a plain sentence and then
 * the viewer's own numbers for the period. A number not known yet (the table
 * or all-play loading, no record) leaves its line out rather than guessing.
 */
export function explanationItems(
  table: TeamTable | null,
  allPlay: AllPlayTable | null,
  myTeamKey: string
): ExplanationItem[] {
  const categories =
    table === null
      ? "the league's categories"
      : `the ${plural(table.settings.categories.length, "category", "categories")}`;
  return [
    {
      term: "W–L–T",
      text: `Every week you play one team. Each of ${categories} is a win, loss or tie, and they add up over the period. This is the official Yahoo record, and Standings ranks by it.`,
      yours: table === null ? null : recordLine(table, myTeamKey),
    },
    {
      term: "All-play",
      text: "The same scoring, but as if you played every other team every week. It takes the luck of the schedule out, so it shows how strong a team really is.",
      yours: allPlayLine(allPlay, myTeamKey),
    },
    {
      term: "Luck",
      text: "Your real category wins minus the wins your all-play rate would give you over the same categories. A tie counts as half a win. Plus means the schedule helped you; minus means it hurt.",
      yours: table === null ? null : luckLine(table, allPlay, myTeamKey),
    },
    {
      term: "Categories",
      text: "Each team ranked in each category from the period's totals. 1 is best; the top three are green and the bottom three red.",
      yours: table === null ? null : categoriesLine(table, myTeamKey),
    },
  ];
}
