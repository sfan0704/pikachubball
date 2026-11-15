import { z } from "zod";
import type {
  LeagueCategory,
  LeagueSettings,
  MatchupPairing,
  Scope,
  TeamRow,
  TeamTable,
  WeekGames,
} from "../../shared/domain";
import {
  fragments,
  indexed,
  leagueSection,
  parseYahoo,
  YahooResponseError,
  yahooFlag,
  yahooInteger,
} from "./yahoo-shapes";
import { nbaStatMakeup } from "./yahoo/nba-stat-makeup";

const statId = z.coerce.string();

const gameCount = yahooInteger.pipe(z.number().nonnegative());

/** A week's games for starting slots; Yahoo sends it with each team in a scoreboard. */
const remainingGamesSchema = z.object({
  total: z.object({
    remaining_games: gameCount,
    live_games: gameCount,
    completed_games: gameCount,
  }),
});

const leagueMetaSchema = z.object({
  league_key: z.string().min(1),
  name: z.string(),
  season: yahooInteger,
  scoring_type: z.string(),
  current_week: yahooInteger,
  start_week: yahooInteger,
  end_week: yahooInteger,
  // Yahoo sends the flag only for a finished league.
  is_finished: yahooFlag.optional(),
});

const settingsSchema = z.tuple([
  z.object({
    stat_categories: z.object({
      stats: z.array(
        z.object({
          stat: z.object({
            stat_id: statId,
            display_name: z.string(),
            sort_order: z.coerce.string().pipe(z.enum(["0", "1"])),
            is_only_display_stat: yahooFlag.optional(),
          }),
        })
      ),
    }),
  }),
]);

const teamSchema = z.object({
  team_key: z.string().min(1),
  name: z.string(),
  managers: z
    .array(z.object({ manager: z.object({ nickname: z.string().optional() }) }))
    .optional(),
  team_stats: z.object({
    stats: z.array(z.object({ stat: z.object({ stat_id: statId, value: z.unknown() }) })),
  }),
  // Only the standings carry the season record.
  team_standings: z
    .object({
      outcome_totals: z.object({ wins: yahooInteger, losses: yahooInteger, ties: yahooInteger }),
    })
    .optional(),
  // Only the scoreboard carries the week's games; the standings never do.
  team_remaining_games: remainingGamesSchema.optional(),
});
type YahooTeam = z.infer<typeof teamSchema>;

const teamEntries = indexed(z.object({ team: fragments(teamSchema) }));

const standingsSchema = z.tuple([z.object({ teams: teamEntries })]);

const matchupSchema = z.object({
  winner_team_key: z.string().optional(),
  is_tied: yahooFlag.optional(),
  "0": z.object({ teams: teamEntries }),
});

const scoreboardSchema = z.object({
  week: yahooInteger,
  "0": z.object({ matchups: indexed(z.object({ matchup: matchupSchema })) }),
});

const responseSchema = z.object({
  fantasy_content: z.object({ league: z.array(z.unknown()).min(2) }),
});

function readLeague(response: unknown) {
  const [meta, ...sections] = parseYahoo(responseSchema, response).fantasy_content.league;
  return { meta: parseYahoo(leagueMetaSchema, meta), sections };
}

function toSettings(
  meta: z.infer<typeof leagueMetaSchema>,
  settingsSection: unknown
): LeagueSettings {
  const [settings] = parseYahoo(settingsSchema, settingsSection);
  const categories: LeagueCategory[] = settings.stat_categories.stats
    .map(({ stat }) => stat)
    .filter((stat) => !stat.is_only_display_stat)
    .map((stat) => ({
      statId: stat.stat_id,
      displayName: stat.display_name,
      direction: stat.sort_order === "1" ? "higher" : "lower",
      makeup: nbaStatMakeup(stat.stat_id),
    }));
  return {
    leagueKey: meta.league_key,
    name: meta.name,
    season: meta.season,
    scoringType: meta.scoring_type,
    categories,
    startWeek: meta.start_week,
    endWeek: meta.end_week,
    currentWeek: meta.current_week,
    isFinished: meta.is_finished ?? false,
  };
}

/** A plain number from Yahoo's text (".471", "1.85", "12"); null when absent or "-". */
function toDecimal(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : value;
  return typeof text === "string" && /^(\d+(\.\d*)?|\.\d+)$/.test(text.trim())
    ? Number(text.trim())
    : null;
}

/** "127/298" as makes and attempts; null when the value isn't in that form. */
function toMakesAttempts(value: unknown): [number, number] | null {
  const match = typeof value === "string" ? /^(\d+)\/(\d+)$/.exec(value.trim()) : null;
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** Yahoo's combined makes/attempts stat id for a ratio's parts: "9004003" for "4" over "3". */
function combinedStatId(topStatId: string, bottomStatId: string): string {
  return `9${topStatId.padStart(3, "0")}${bottomStatId.padStart(3, "0")}`;
}

function statValues(team: YahooTeam): Map<string, unknown> {
  return new Map(team.team_stats.stats.map(({ stat }) => [stat.stat_id, stat.value]));
}

/**
 * A category's value. A ratio whose makes and attempts Yahoo also sends (FG%
 * with "9004003") is exact makes over attempts, so rounding never makes a
 * tie; anything else is Yahoo's own value.
 */
function categoryValue(values: Map<string, unknown>, category: LeagueCategory): number | null {
  const makeup = category.makeup;
  if (makeup.kind === "ratio") {
    const parts = toMakesAttempts(
      values.get(combinedStatId(makeup.topStatId, makeup.bottomStatId))
    );
    if (parts !== null) {
      return parts[1] === 0 ? null : parts[0] / parts[1];
    }
  }
  return toDecimal(values.get(category.statId));
}

/** The team's value in each of the league's categories, whatever they are. */
function toCategoryValues(
  team: YahooTeam,
  categories: readonly LeagueCategory[]
): Record<string, number | null> {
  const values = statValues(team);
  return Object.fromEntries(
    categories.map((category) => [category.statId, categoryValue(values, category)])
  );
}

/** The week's games, or null when Yahoo's table didn't say. */
function toWeekGames(team: YahooTeam): WeekGames | null {
  const games = team.team_remaining_games?.total;
  return games
    ? {
        remaining: games.remaining_games,
        live: games.live_games,
        completed: games.completed_games,
      }
    : null;
}

function toRow(team: YahooTeam, scope: Scope, settings: LeagueSettings): TeamRow {
  const nickname = team.managers?.[0]?.manager.nickname;
  return {
    teamKey: team.team_key,
    teamName: team.name,
    // Yahoo masks managers who hide their name.
    managerName: nickname && nickname !== "--hidden--" ? nickname : null,
    categoryValues: toCategoryValues(team, settings.categories),
    games: scope.kind === "week" ? toWeekGames(team) : null,
    record: team.team_standings?.outcome_totals ?? null,
  };
}

function build(
  scope: Scope,
  settings: LeagueSettings,
  teams: readonly YahooTeam[],
  pairings: readonly MatchupPairing[],
  fetchedAt: string
): TeamTable {
  return {
    scope,
    settings,
    teams: teams.map((team) => toRow(team, scope, settings)),
    pairings,
    fetchedAt,
  };
}

/** The season table from a `/league/{key};out=settings,standings` response. */
export function parseSeasonTable(response: unknown, fetchedAt: string): TeamTable {
  const { meta, sections } = readLeague(response);
  const settings = toSettings(meta, leagueSection(sections, "settings"));
  const [standings] = parseYahoo(standingsSchema, leagueSection(sections, "standings"));
  return build(
    { kind: "season" },
    settings,
    standings.teams.map((entry) => entry.team),
    [],
    fetchedAt
  );
}

function toPairing(matchup: z.infer<typeof matchupSchema>): MatchupPairing {
  const keys = matchup["0"].teams.map((entry) => entry.team.team_key);
  if (keys.length !== 2) {
    throw new YahooResponseError(["scoreboard: a matchup does not have two teams"]);
  }
  return {
    teamKeys: [keys[0], keys[1]],
    winnerTeamKey: matchup.winner_team_key ?? null,
    isTied: matchup.is_tied ?? false,
  };
}

/**
 * A week's table from a `/league/{key};out=settings,scoreboard` response.
 * When `expectedWeek` is given, a response for another week is rejected.
 */
export function parseWeekTable(
  response: unknown,
  fetchedAt: string,
  expectedWeek?: number
): TeamTable {
  const { meta, sections } = readLeague(response);
  const settings = toSettings(meta, leagueSection(sections, "settings"));
  const scoreboard = parseYahoo(scoreboardSchema, leagueSection(sections, "scoreboard"));
  if (expectedWeek !== undefined && scoreboard.week !== expectedWeek) {
    throw new YahooResponseError([`scoreboard: expected week ${expectedWeek}`]);
  }
  const matchups = scoreboard["0"].matchups.map((entry) => entry.matchup);
  const teams = matchups.flatMap((matchup) => matchup["0"].teams.map((entry) => entry.team));
  return build(
    { kind: "week", week: scoreboard.week },
    settings,
    teams,
    matchups.map(toPairing),
    fetchedAt
  );
}
