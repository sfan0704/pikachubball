/**
 * The stand-in's daily-stats answers, for the load test's call counts. Yahoo
 * bodies for any team, date and player list are made from one scrubbed
 * recording each (recorded in game 478), relabelled with the keys asked for, so
 * the app's real Yahoo source parses them and every call is counted. The values
 * are the recording's, not a coherent league: only the calls are measured.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Json = Record<string, unknown>;

const RECORDED_GAME = "478";
const RECORDED_TEAM = "478.l.100000.t.10";
const RECORDED_DATE = "2026-10-27";

/** Each daily-stats recording a relabelled body starts from, under the fixtures' daily-stats folder. */
const RECORDINGS = {
  teamDay: "fan-91-week-2/mine-2026-10-27-roster-stats",
  gameLogs: "d3-game-logs-by-key",
  season: "d4-players-season",
  lastweek: "d4-players-lastweek",
  lastmonth: "d4-players-lastmonth",
  weeks: "fan-91-week-2/game-weeks",
  transactions: "d7-transactions-own-team",
  draft: "d8-draft-results",
} as const;

type RecordingName = keyof typeof RECORDINGS;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `text` with every whole occurrence of each key replaced by its value, longest keys first. */
function relabel(text: string, labels: Readonly<Record<string, string>>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => b.length - a.length)
    .reduce(
      (out, [from, to]) => out.replace(new RegExp(`(?<![\\w.])${escape(from)}(?![\\w])`, "g"), to),
      text
    );
}

/** The recorded game's keys (league, team, transaction) moved into `game`. */
function inGame(text: string, game: string): string {
  return text
    .replace(/(?<![\w.])478\.l\./g, `${game}.l.`)
    .replace(/(?<![\w.])478\.p\./g, `${game}.p.`)
    .replace(/"game_key":\s*"478"/g, `"game_key":"${game}"`)
    .replace(/\/game\/478\//g, `/game/${game}/`);
}

/** Yahoo's numbered collection (`{"0": …, "1": …, "count": n}`) of `items`. */
function collection(items: readonly unknown[]): Json {
  return Object.fromEntries([
    ...items.map((item, i) => [String(i), item]),
    ["count", items.length],
  ]);
}

/** Copies of a recorded player entry, one for each key asked for. */
function playersFor(template: unknown, templateKey: string, keys: readonly string[]): Json {
  const text = JSON.stringify(template);
  const templateId = templateKey.split(".p.")[1];
  return collection(
    keys.map((key) => {
      const id = key.split(".p.")[1];
      return JSON.parse(
        text
          .replaceAll(`"${templateKey}"`, `"${key}"`)
          .replaceAll(`"player_id":"${templateId}"`, `"player_id":"${id}"`)
      ) as unknown;
    })
  );
}

/** The first player entry of a numbered players collection, and its key. */
function firstPlayer(players: Json): { entry: unknown; key: string } {
  const entry = players["0"];
  const key = /"player_key":"([^"]+)"/.exec(JSON.stringify(entry))?.[1];
  if (key === undefined) {
    throw new Error("The recording's first player has no key");
  }
  return { entry, key };
}

/** Daily-stats bodies for the stand-in, made from the recordings in `fixturesDir/daily-stats`. */
export class DailyStatsRecordings {
  private readonly texts: Record<RecordingName, string>;

  constructor(fixturesDir: string) {
    const read = (name: string) =>
      readFileSync(join(fixturesDir, "daily-stats", `${name}.json`), "utf8");
    this.texts = Object.fromEntries(
      Object.entries(RECORDINGS).map(([key, name]) => [key, JSON.stringify(JSON.parse(read(name)))])
    ) as Record<RecordingName, string>;
  }

  /** Yahoo's body for a daily-stats path, or null when the path isn't one of them. */
  body(path: string): Json | null {
    const day =
      /^\/team\/((\d+)\.l\.\d+\.t\.(\d+))\/roster;date=([\d-]+)\/players\/stats;type=date;date=\4$/.exec(
        path
      );
    if (day) {
      return this.teamDay(day[1], day[2], Number(day[3]), day[4]);
    }
    const logs = /^\/league\/((\d+)\.l\.\d+)\/players;player_keys=([^;/]+);out=game_log$/.exec(
      path
    );
    if (logs) {
      return this.gameLogs(logs[1], logs[2], logs[3].split(","));
    }
    const totals = /^\/players;player_keys=([^;/]+)\/stats;type=(season|lastweek|lastmonth)$/.exec(
      path
    );
    if (totals) {
      return this.periodTotals(
        totals[2] as "season" | "lastweek" | "lastmonth",
        totals[1].split(",")
      );
    }
    const weeks = /^\/game\/(\d+)\/game_weeks$/.exec(path);
    if (weeks) {
      return this.parse(
        inGame(this.texts.weeks, weeks[1]).replaceAll(`"${RECORDED_GAME}"`, `"${weeks[1]}"`)
      );
    }
    const moves =
      /^\/league\/((\d+)\.l\.\d+)\/transactions;types=add,drop,trade;team_key=(\1\.t\.\d+)$/.exec(
        path
      );
    if (moves) {
      return this.inLeague("transactions", moves[1], moves[2], { "478.l.14822.t.10": moves[3] });
    }
    const draft = /^\/league\/((\d+)\.l\.\d+)\/draftresults$/.exec(path);
    return draft ? this.inLeague("draft", draft[1], draft[2], {}) : null;
  }

  /**
   * A team's day: the recorded roster with player keys made unique to the team
   * (team number × 100000 + recorded id), so both Matchup teams together need
   * as many game-log and totals calls as two real rosters.
   */
  private teamDay(teamKey: string, game: string, team: number, date: string): Json {
    const text = relabel(this.texts.teamDay, { [RECORDED_TEAM]: teamKey, [RECORDED_DATE]: date })
      .replace(
        /(?<![\w.])478\.p\.(\d+)/g,
        (_, id: string) => `${game}.p.${team * 100000 + Number(id)}`
      )
      .replace(
        /"player_id":"(\d+)"/g,
        (_, id: string) => `"player_id":"${team * 100000 + Number(id)}"`
      );
    return this.parse(inGame(text, game));
  }

  private gameLogs(leagueKey: string, game: string, keys: readonly string[]): Json {
    const body = this.inLeague("gameLogs", leagueKey, game, {});
    const league = (body.fantasy_content as Json).league as Json[];
    const template = firstPlayer(league[1].players as Json);
    league[1] = { ...league[1], players: playersFor(template.entry, template.key, keys) };
    return body;
  }

  private periodTotals(period: "season" | "lastweek" | "lastmonth", keys: readonly string[]): Json {
    const body = this.parse(this.texts[period]);
    const content = body.fantasy_content as Json;
    const template = firstPlayer(content.players as Json);
    content.players = playersFor(template.entry, template.key, keys);
    return body;
  }

  /** A league-wide recording moved into `leagueKey`, with any extra keys relabelled first. */
  private inLeague(
    name: RecordingName,
    leagueKey: string,
    game: string,
    labels: Readonly<Record<string, string>>
  ): Json {
    return this.parse(
      inGame(relabel(this.texts[name], { ...labels, "478.l.14822": leagueKey }), game)
    );
  }

  private parse(text: string): Json {
    return JSON.parse(text) as Json;
  }
}
