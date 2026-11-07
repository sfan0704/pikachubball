// Reads what the research capture needs (league, team, week, dates, players) out of
// Yahoo responses. Pure: Yahoo's nesting varies, so these walk the whole response.

const TEAM_KEY_IN_TEXT = /"team_key":"(\d+)\.l\.(\d+)\.t\.(\d+)"/g;
const DAY_MS = 86_400_000;
// Yahoo's fantasy day follows US Eastern time.
const YAHOO_TIME_ZONE = "America/New_York";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every value stored under the key, anywhere in the response, in document order. */
export function valuesOf(response: unknown, key: string): unknown[] {
  if (Array.isArray(response)) {
    return response.flatMap((item) => valuesOf(item, key));
  }
  if (!isRecord(response)) {
    return [];
  }
  return Object.entries(response).flatMap(([name, value]) =>
    name === key ? [value, ...valuesOf(value, key)] : valuesOf(value, key)
  );
}

/** The signed-in manager's team in the newest league, or in the chosen league. */
export function ownTeam(
  userTeams: unknown,
  chosenLeague?: string
): { leagueKey: string; teamKey: string } {
  const teams = [...JSON.stringify(userTeams).matchAll(TEAM_KEY_IN_TEXT)]
    .map(([, game, league, team]) => ({
      game: Number(game),
      leagueKey: `${game}.l.${league}`,
      teamKey: `${game}.l.${league}.t.${team}`,
    }))
    .filter((team) => !chosenLeague || team.leagueKey === chosenLeague)
    .sort((a, b) => b.game - a.game);
  const newest = teams[0];
  if (!newest) {
    throw new Error(
      chosenLeague
        ? `You have no team in ${chosenLeague}`
        : "Yahoo lists no NBA teams for this account"
    );
  }
  return { leagueKey: newest.leagueKey, teamKey: newest.teamKey };
}

/** The league's current scoring week. */
export function currentWeek(league: unknown): number {
  const week = Number(valuesOf(league, "current_week")[0]);
  if (!Number.isInteger(week) || week < 1) {
    throw new Error("The league settings have no current_week");
  }
  return week;
}

/** Every date from start to end, both included. */
export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (
    let day = Date.parse(`${start}T00:00:00Z`);
    day <= Date.parse(`${end}T00:00:00Z`);
    day += DAY_MS
  ) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates;
}

/** Today, yesterday and tomorrow on Yahoo's fantasy calendar. */
export function fantasyDates(now: Date): { today: string; yesterday: string; tomorrow: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: YAHOO_TIME_ZONE }).format(now);
  const midnight = Date.parse(`${today}T00:00:00Z`);
  const day = (offset: number): string =>
    new Date(midnight + offset * DAY_MS).toISOString().slice(0, 10);
  return { today, yesterday: day(-1), tomorrow: day(1) };
}

interface RosterPlayer {
  key: string;
  injured: boolean;
}

// A player's properties are sibling single-key objects in one array, such as [{player_key}, {name}, {status}].
function rosterPlayers(response: unknown, found: Map<string, RosterPlayer>): void {
  if (Array.isArray(response)) {
    const siblings = response.flat().filter(isRecord);
    const key = siblings.find((item) => typeof item.player_key === "string")?.player_key;
    if (typeof key === "string" && !found.has(key)) {
      found.set(key, {
        key,
        injured: siblings.some((item) => typeof item.status === "string" && item.status !== ""),
      });
    }
    response.forEach((item) => rosterPlayers(item, found));
  } else if (isRecord(response)) {
    Object.values(response).forEach((value) => rosterPlayers(value, found));
  }
}

/** Three sample players from a roster: a healthy one, an injured one if any, and one more. */
export function samplePlayers(roster: unknown): [string, string, string] {
  const found = new Map<string, RosterPlayer>();
  rosterPlayers(roster, found);
  const players = [...found.values()];
  const healthy = players.find((player) => !player.injured);
  const injured = players.find((player) => player.injured && player !== healthy);
  const chosen = [healthy, injured].filter((player) => player !== undefined);
  const rest = players.filter((player) => !chosen.includes(player));
  const [p1, p2, p3] = [...chosen, ...rest].map((player) => player.key);
  if (!p1 || !p2 || !p3) {
    throw new Error("The roster has fewer than three players; pass --players=key1,key2,key3");
  }
  return [p1, p2, p3];
}
