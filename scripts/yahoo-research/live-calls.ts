// The two daily-stats calls the retrieval plan had not tried (FAN-102): game logs for 25
// players by key (D3) and one team's transactions including trades (D7). Pure.
import { valuesOf } from "./discover";

/** Yahoo's largest player_keys list and page. */
export const MAX_KEYS = 25;

/** A rostered player in a game-log page, and whether one of their games is live now. */
export interface GameLogPlayer {
  key: string;
  live: boolean;
}

const isLive = (value: unknown): boolean => value === 1 || value === "1" || value === true;

/** Every player in a game-log response, in order, marking those with a live game. */
export function gameLogPlayers(response: unknown): GameLogPlayer[] {
  return valuesOf(response, "player").flatMap((player) => {
    const key = valuesOf(player, "player_key")[0];
    return typeof key === "string"
      ? [{ key, live: valuesOf(player, "is_game_live").some(isLive) }]
      : [];
  });
}

/** Up to 25 player keys, players with a live game first, so the call shows a live game. */
export function multiKeyPlayers(pages: unknown[]): string[] {
  const players = pages.flatMap(gameLogPlayers);
  const ordered = [...players.filter((p) => p.live), ...players.filter((p) => !p.live)];
  return [...new Set(ordered.map((p) => p.key))].slice(0, MAX_KEYS);
}

/** The first team in the transactions feed that made a trade, if any did. */
export function tradingTeam(feed: unknown): string | undefined {
  const [team] = valuesOf(feed, "trader_team_key").filter((key) => typeof key === "string");
  return typeof team === "string" ? team : undefined;
}

/** D3: game logs for many players by key, the form the plan wants. */
export function gameLogsPath(leagueKey: string, playerKeys: string[]): string {
  return `/league/${leagueKey}/players;player_keys=${playerKeys.join(",")};out=game_log`;
}

/** D7: one team's adds, drops and trades. */
export function teamTransactionsPath(leagueKey: string, teamKey: string): string {
  return `/league/${leagueKey}/transactions;types=add,drop,trade;team_key=${teamKey}`;
}

/** What a D3 answer shows: players asked for, players returned, players with a live game. */
export function gameLogsSummary(asked: string[], response: unknown): string {
  const returned = gameLogPlayers(response);
  const missing = asked.filter((key) => !returned.some((p) => p.key === key));
  return [
    `asked ${asked.length} players, got ${returned.length}`,
    `${returned.filter((p) => p.live).length} with a live game`,
    missing.length > 0 ? `missing: ${missing.join(", ")}` : "none missing",
  ].join("; ");
}

/** What a D7 answer shows: transactions by type, and how many don't involve the team. */
export function transactionsSummary(teamKey: string, response: unknown): string {
  const transactions = valuesOf(response, "transaction");
  const types = new Map<string, number>();
  for (const transaction of transactions) {
    const type = String(valuesOf(transaction, "type")[0]);
    types.set(type, (types.get(type) ?? 0) + 1);
  }
  const others = transactions.filter((t) => !JSON.stringify(t).includes(`"${teamKey}"`));
  const byType = [...types].map(([type, count]) => `${type} ${count}`).join(", ");
  return `${transactions.length} transactions (${byType || "none"}); ${others.length} without ${teamKey}`;
}

/** One recorded call, for the README. */
export interface LiveCallRow {
  label: string;
  file: string;
  path: string;
  status: number;
  at: string;
  summary: string;
}

/** The README beside the recordings: when each call ran, Yahoo's status and what it showed. */
export function liveCallsReadme(leagueKey: string, rows: LiveCallRow[]): string {
  const sections = rows.map((r) =>
    [
      `## ${r.label}`,
      "",
      `- File: \`${r.file}\``,
      `- GET \`${r.path}\` (with \`?format=json\`)`,
      `- ${r.at}: HTTP ${r.status}; ${r.summary}`,
    ].join("\n")
  );
  return [
    "# Daily-stats call recordings (FAN-102)",
    `Recorded by \`npm run capture:yahoo-live-calls\` in league ${leagueKey}, scrubbed of team, manager and league names. Each file is Yahoo's response body.`,
    ...sections,
  ]
    .join("\n\n")
    .concat("\n");
}
