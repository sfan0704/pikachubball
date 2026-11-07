// The Yahoo API calls each daily-stats research ticket asked for (FAN-92..FAN-96;
// FAN-91's finished-week capture is in week.ts),
// filled in for one league. Pure: everything it needs is in the context.

/** What the capture found out about the account before recording the research calls. */
export interface ResearchContext {
  /** Such as 466.l.12345. */
  leagueKey: string;
  /** The signed-in manager's team in that league, such as 466.l.12345.t.4. */
  teamKey: string;
  currentWeek: number;
  /** US Eastern dates, YYYY-MM-DD. */
  today: string;
  yesterday: string;
  tomorrow: string;
  /** P1 a healthy player, P2 an injured one when the roster has one, P3 another. */
  players: [string, string, string];
}

/** One recorded call: the ticket's own label for it, the file it goes to, and the path. */
export interface PlannedCall {
  ticket: string;
  label: string;
  file: string;
  path: string;
}

/** A call that pages with start/count until a short page; each page is its own file. */
export interface PagedCall {
  ticket: string;
  label: string;
  file: string;
  pathAt: (start: number) => string;
  /** The key that appears once per item, used to count a page's items. */
  itemKey: string;
}

/** Yahoo's largest page. */
export const PAGE_SIZE = 25;

const call = (ticket: string, label: string, file: string, path: string): PlannedCall => ({
  ticket,
  label,
  file,
  path,
});

function fan92(ctx: ResearchContext): PlannedCall[] {
  const { leagueKey: L, teamKey: T, today, tomorrow } = ctx;
  const t = "FAN-92";
  return [
    call(
      t,
      "B1",
      "roster-today-stats",
      `/team/${T}/roster;date=${today}/players/stats;type=date;date=${today}`
    ),
    call(t, "B2", "roster-tomorrow", `/team/${T}/roster;date=${tomorrow}`),
    call(t, "B3", "game-weeks", "/game/nba/game_weeks"),
    call(t, "B4", "scoreboard", `/league/${L}/scoreboard`),
  ];
}

function fan93(ctx: ResearchContext): PlannedCall[] {
  const { leagueKey: L, yesterday } = ctx;
  const P = ctx.players.join(",");
  const t = "FAN-93";
  return [
    call(t, "1", "players-season", `/players;player_keys=${P}/stats;type=season`),
    call(
      t,
      "2",
      "league-players-season",
      `/league/${L}/players;player_keys=${P}/stats;type=season`
    ),
    call(t, "3", "players-average-season", `/players;player_keys=${P}/stats;type=average_season`),
    call(t, "4a", "players-lastweek", `/players;player_keys=${P}/stats;type=lastweek`),
    call(t, "4b", "players-lastmonth", `/players;player_keys=${P}/stats;type=lastmonth`),
    call(
      t,
      "5",
      "players-yesterday",
      `/players;player_keys=${P}/stats;type=date;date=${yesterday}`
    ),
    call(
      t,
      "6",
      "league-players-stats-collection",
      `/league/${L}/players;player_keys=${P}/stats_collection;types=season,average_season,lastweek,lastmonth;extra_stat_ids=0,3,4,6,7`
    ),
    call(
      t,
      "7",
      "league-player-game-log",
      `/league/${L}/players;player_keys=${ctx.players[0]};out=game_log`
    ),
  ];
}

function fan94(ctx: ResearchContext): PlannedCall[] {
  const { leagueKey: L, currentWeek: W } = ctx;
  const P = ctx.players.join(",");
  const P1 = ctx.players[0];
  const t = "FAN-94";
  return [
    call(
      t,
      "A1",
      "ranks-projected",
      `/league/${L}/players;player_keys=${P};out=ranks;ranks=projected_next7days,projected_season_remaining,projected_week`
    ),
    call(
      t,
      "A2",
      "stats-projected-next7days",
      `/league/${L}/players;player_keys=${P1}/stats;type=projected_next7days`
    ),
    call(
      t,
      "A3",
      "stats-projected-week",
      `/league/${L}/players;player_keys=${P1}/stats;type=projected_week;week=${W}`
    ),
    call(
      t,
      "A4",
      "stats-projected-season",
      `/league/${L}/players;player_keys=${P1}/stats;type=projected_season`
    ),
    call(
      t,
      "A5",
      "available-sorted-by-ps7",
      `/league/${L}/players;status=A;sort=AR_PS7;count=5;out=ranks;ranks=projected_next7days`
    ),
  ];
}

function fan95(ctx: ResearchContext): PlannedCall[] {
  const { leagueKey: L, currentWeek: W, today } = ctx;
  const P = ctx.players.join(",");
  const t = "FAN-95";
  const players = `/league/${L}/players`;
  return [
    call(
      t,
      "A1",
      "available-ownership-percent",
      `${players};status=A;start=0;count=25;out=ownership,percent_owned`
    ),
    call(t, "A4", "available-count-50", `${players};status=A;count=50`),
    call(t, "A5a", "search-jam", `${players};status=A;search=jam`),
    call(t, "A5b", "search-doncic", `${players};status=A;search=doncic`),
    call(t, "A5c", "position-c", `${players};status=A;position=C`),
    call(t, "A5d", "position-g", `${players};status=A;position=G`),
    call(t, "A6a", "percent-owned", `${players};player_keys=${P}/percent_owned`),
    call(
      t,
      "A6b",
      "percent-owned-week",
      `${players};player_keys=${P}/percent_owned;type=week;week=${W}`
    ),
    call(
      t,
      "A6c",
      "percent-owned-today",
      `${players};player_keys=${P}/percent_owned;type=date;date=${today}`
    ),
    call(t, "A7", "waivers-ownership", `${players};status=W/ownership`),
  ];
}

function fan96(ctx: ResearchContext): PlannedCall[] {
  const L = ctx.leagueKey;
  const t = "FAN-96";
  return [
    call(t, "1", "draftresults", `/league/${L}/draftresults`),
    call(t, "2", "transactions-default", `/league/${L}/transactions`),
    call(t, "4", "transactions-add-drop-trade", `/league/${L}/transactions;types=add,drop,trade`),
    call(t, "5", "transactions-commish", `/league/${L}/transactions;type=commish`),
    call(t, "6", "teams-roster", `/league/${L}/teams/roster`),
    call(t, "7", "settings", `/league/${L}/settings`),
  ];
}

/** Every single call, in ticket order. */
export function plannedCalls(ctx: ResearchContext): PlannedCall[] {
  return [fan92, fan93, fan94, fan95, fan96].flatMap((tickets) => tickets(ctx));
}

/** The calls that page to the end: taken players, the whole pool, and the transactions. */
export function pagedCalls(ctx: ResearchContext): PagedCall[] {
  const L = ctx.leagueKey;
  return [
    {
      ticket: "FAN-95",
      label: "A2",
      file: "taken-ownership",
      pathAt: (start) =>
        `/league/${L}/players;status=T;start=${start};count=${PAGE_SIZE}/ownership`,
      itemKey: "player_key",
    },
    {
      ticket: "FAN-95",
      label: "A3",
      file: "pool",
      pathAt: (start) => `/league/${L}/players;start=${start};count=${PAGE_SIZE}`,
      itemKey: "player_key",
    },
    {
      ticket: "FAN-96",
      label: "3",
      file: "transactions-paged",
      pathAt: (start) => `/league/${L}/transactions;start=${start};count=${PAGE_SIZE}`,
      itemKey: "transaction_key",
    },
  ];
}
