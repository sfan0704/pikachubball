// The FAN-92 follow-up: rostered players' game logs, read twice a few minutes apart, to see
// how Yahoo shows a live game and whether one call carries many players' logs. Pure.

/** One game-log call: the file it goes to and the path. */
export interface GameLogCall {
  file: string;
  path: string;
}

// Two pages of rostered players span nearly every NBA team, so the logs show each team's next games.
const PAGE_STARTS = [0, 25];

/** The batched game-log calls for one round, numbered so repeated rounds sort together. */
export function gameLogCalls(leagueKey: string, round: number): GameLogCall[] {
  return PAGE_STARTS.map((start) => ({
    file: `round-${round}-rostered-start-${start}.json`,
    path: `/league/${leagueKey}/players;status=T;start=${start};count=25;out=game_log`,
  }));
}

/** The README that lists every recorded call with its time and HTTP status. */
export function gameLogReadme(
  leagueKey: string,
  rows: { file: string; path: string; status: number; at: string }[]
): string {
  const lines = rows.map((r) => `| ${r.at} | ${r.status} | \`${r.file}\` | \`${r.path}\` |`);
  return [
    "# FAN-92 game-log capture",
    `- League: ${leagueKey}`,
    "| Time (UTC) | HTTP status | File | GET path (?format=json) |",
    "| --- | --- | --- | --- |",
    ...lines,
    "",
  ].join("\n");
}
