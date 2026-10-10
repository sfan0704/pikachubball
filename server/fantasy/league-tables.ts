import { z } from "zod";
import type {
  CategoryKey,
  LeagueCategory,
  LeagueSettings,
  MatchupPairing,
  Scope,
  TeamRow,
  TeamTable,
  TeamTotals,
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

/** Yahoo's stat id for each of the nine standard categories. */
const CATEGORY_BY_STAT_ID: Readonly<Record<string, CategoryKey>> = {
  "5": "fgPct",
  "8": "ftPct",
  "10": "tpm",
  "12": "pts",
  "15": "reb",
  "16": "ast",
  "17": "stl",
  "18": "blk",
  "19": "to",
};

const FG_MAKES_ATTEMPTS = "9004003";
const FT_MAKES_ATTEMPTS = "9007006";
const COUNTING_STATS = {
  tpm: "10",
  pts: "12",
  reb: "15",
  ast: "16",
  stl: "17",
  blk: "18",
  to: "19",
} as const;

const statId = z.coerce.string();

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
      key: CATEGORY_BY_STAT_ID[stat.stat_id] ?? null,
      displayName: stat.display_name,
      direction: stat.sort_order === "1" ? "higher" : "lower",
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

/** A whole number from Yahoo's text; null when absent or not a plain number. */
function toCount(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : value;
  return typeof text === "string" && /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** "127/298" as makes and attempts; both null when the value isn't in that form. */
function toMakesAttempts(value: unknown): [number | null, number | null] {
  const match = typeof value === "string" ? /^(\d+)\/(\d+)$/.exec(value.trim()) : null;
  return match ? [Number(match[1]), Number(match[2])] : [null, null];
}

function toTotals(team: YahooTeam): TeamTotals {
  const values = new Map(team.team_stats.stats.map(({ stat }) => [stat.stat_id, stat.value]));
  const [fgMakes, fgAttempts] = toMakesAttempts(values.get(FG_MAKES_ATTEMPTS));
  const [ftMakes, ftAttempts] = toMakesAttempts(values.get(FT_MAKES_ATTEMPTS));
  return {
    fgMakes,
    fgAttempts,
    ftMakes,
    ftAttempts,
    tpm: toCount(values.get(COUNTING_STATS.tpm)),
    pts: toCount(values.get(COUNTING_STATS.pts)),
    reb: toCount(values.get(COUNTING_STATS.reb)),
    ast: toCount(values.get(COUNTING_STATS.ast)),
    stl: toCount(values.get(COUNTING_STATS.stl)),
    blk: toCount(values.get(COUNTING_STATS.blk)),
    to: toCount(values.get(COUNTING_STATS.to)),
  };
}

function toRow(team: YahooTeam): TeamRow {
  const nickname = team.managers?.[0]?.manager.nickname;
  return {
    teamKey: team.team_key,
    teamName: team.name,
    // Yahoo masks managers who hide their name.
    managerName: nickname && nickname !== "--hidden--" ? nickname : null,
    totals: toTotals(team),
  };
}

function build(
  scope: Scope,
  settings: LeagueSettings,
  teams: readonly YahooTeam[],
  pairings: readonly MatchupPairing[],
  fetchedAt: string
): TeamTable {
  return { scope, settings, teams: teams.map(toRow), pairings, fetchedAt };
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
