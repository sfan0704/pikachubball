// Records every Yahoo API call the daily-stats research tickets (FAN-91..FAN-96) asked
// for, in one sign-in, into yahoo-research/<ticket>/ with each call's status and
// scrubbed response, plus a checklist of the website pages only a browser can save.
// FAN-91 gets the finished-week capture (the same files as capture:yahoo-week).
// Usage: npm run capture:yahoo-research [-- <league_key>] [-- --players=<k1>,<k2>,<k3>]
// Only read-only GET calls. Calls Yahoo rejects are recorded, not fatal. Nothing is
// written if a removed personal value survives scrubbing.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { YahooScrubber } from "../server/dev/scrub-yahoo";
import {
  accessToken,
  fetchJson,
  LEAGUE_KEY,
  probe,
  USER_TEAMS_PATH,
  type Probe,
} from "./yahoo-capture-client";
import { browserSteps, type BrowserStep } from "./yahoo-research/browser";
import {
  currentWeek,
  fantasyDates,
  ownTeam,
  samplePlayers,
  valuesOf,
} from "./yahoo-research/discover";
import {
  PAGE_SIZE,
  pagedCalls,
  plannedCalls,
  type PagedCall,
  type ResearchContext,
} from "./yahoo-research/plan";
import { checkLeaks } from "./yahoo-research/leaks";
import { recordWeek } from "./yahoo-research/week";

const OUTPUT_DIR = "yahoo-research";
const PLAYER_KEYS = /^--players=(\d+\.p\.\d+),(\d+\.p\.\d+),(\d+\.p\.\d+)$/;
// The whole NBA pool is about 25 pages; this only stops a page that never comes back short.
const MAX_PAGES = 40;

interface Recorded {
  ticket: string;
  label: string;
  file: string;
  path: string;
  status: number;
  body: unknown;
}

interface Options {
  league?: string;
  players?: [string, string, string];
}

function options(args: string[]): Options {
  const chosen: Options = {};
  for (const arg of args) {
    const players = PLAYER_KEYS.exec(arg);
    if (LEAGUE_KEY.test(arg)) {
      chosen.league = arg;
    } else if (players?.[1] && players[2] && players[3]) {
      chosen.players = [players[1], players[2], players[3]];
    } else {
      throw new Error(
        "Pass a league key such as 466.l.12345 and/or --players=466.p.1,466.p.2,466.p.3"
      );
    }
  }
  return chosen;
}

async function discover(token: string, chosen: Options, now: Date): Promise<ResearchContext> {
  const { leagueKey, teamKey } = ownTeam(await fetchJson(USER_TEAMS_PATH, token), chosen.league);
  const week = currentWeek(await fetchJson(`/league/${leagueKey}/settings`, token));
  const dates = fantasyDates(now);
  const players =
    chosen.players ??
    samplePlayers(await fetchJson(`/team/${teamKey}/roster;date=${dates.yesterday}`, token));
  return { leagueKey, teamKey, currentWeek: week, ...dates, players };
}

async function recordCall(path: string, token: string): Promise<Probe> {
  const result = await probe(path, token);
  console.log(`GET ${path} -> ${result.status}`);
  return result;
}

async function recordPages(paged: PagedCall, token: string): Promise<Recorded[]> {
  const pages: Recorded[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_SIZE;
    const path = paged.pathAt(start);
    const { status, body } = await recordCall(path, token);
    pages.push({
      ...paged,
      label: `${paged.label} start=${start}`,
      file: `${paged.file}-start-${start}`,
      path,
      status,
      body,
    });
    if (status !== 200 || valuesOf(body, paged.itemKey).length < PAGE_SIZE) {
      break;
    }
  }
  return pages;
}

async function recordAll(ctx: ResearchContext, token: string): Promise<Recorded[]> {
  const recorded: Recorded[] = [];
  for (const planned of plannedCalls(ctx)) {
    const { status, body } = await recordCall(planned.path, token);
    recorded.push({ ...planned, status, body });
  }
  for (const paged of pagedCalls(ctx)) {
    recorded.push(...(await recordPages(paged, token)));
  }
  return recorded;
}

function contextLines(ctx: ResearchContext): string {
  return [
    `League: ${ctx.leagueKey}; your team: ${ctx.teamKey}; current week: ${ctx.currentWeek}`,
    `Dates (US Eastern): today ${ctx.today}, yesterday ${ctx.yesterday}, tomorrow ${ctx.tomorrow}`,
    `Sample players: P1 ${ctx.players[0]} (healthy), P2 ${ctx.players[1]} (injured if the roster had one), P3 ${ctx.players[2]}`,
  ]
    .map((line) => `- ${line}`)
    .join("\n");
}

function browserSection(steps: BrowserStep[]): string {
  const rows = steps.map(
    (step) =>
      `- [ ] **${step.label}** ${step.what}${step.url ? `\n  ${step.url}` : ""}\n  Save into browser/ as: ${step.saveAs}`
  );
  return [
    "## Browser captures (save into browser/)",
    "Signed in on a desktop browser, open DevTools → Network, tick Preserve log, load the page, then right-click the request list → Export HAR (sanitized).",
    ...rows,
  ].join("\n\n");
}

function ticketReadme(
  ticket: string,
  calls: Recorded[],
  files: string[],
  ctx: ResearchContext,
  steps?: BrowserStep[]
): string {
  const rows = calls.map(
    (c, i) => `| ${c.label} | ${c.status} | \`${files[i]}\` | \`${c.path}\` |`
  );
  return (
    [
      `# ${ticket} Yahoo capture`,
      contextLines(ctx),
      "## API calls",
      [
        "| Ticket label | HTTP status | File | GET path (?format=json) |",
        "| --- | --- | --- | --- |",
        ...rows,
      ].join("\n"),
      steps ? browserSection(steps) : "No browser captures were asked for this ticket.",
    ].join("\n\n") + "\n"
  );
}

const FAN91_README = `# FAN-91 Yahoo capture

The last finished week of your matchup, the same files as \`npm run capture:yahoo-week\`.
\`probes.json\` lists the league, week, dates, both team keys, and every call with \`ok\` or Yahoo's status.
No browser captures were asked for this ticket.
`;

/** Every output file's path and text, built before anything is written. */
function outputs(
  ctx: ResearchContext,
  week: Map<string, unknown>,
  recorded: Recorded[]
): Map<string, string> {
  const scrubber = new YahooScrubber();
  const texts = new Map<string, string>();
  for (const [file, body] of week) {
    texts.set(join("FAN-91", file), `${JSON.stringify(scrubber.scrub(body), null, 2)}\n`);
  }
  texts.set(join("FAN-91", "README.md"), FAN91_README);
  const steps = browserSteps(ctx);
  const tickets = [...new Set(recorded.map((c) => c.ticket))];
  for (const ticket of tickets) {
    const calls = recorded.filter((c) => c.ticket === ticket);
    const files = calls.map((c, i) => `${String(i + 1).padStart(2, "0")}-${c.file}.json`);
    calls.forEach((c, i) => {
      const response = scrubber.scrub(c.body);
      texts.set(
        join(ticket, files[i] ?? ""),
        `${JSON.stringify({ request: c.path, status: c.status, response }, null, 2)}\n`
      );
    });
    texts.set(
      join(ticket, "README.md"),
      ticketReadme(ticket, calls, files, ctx, steps.get(ticket))
    );
  }
  checkLeaks(scrubber, texts);
  return texts;
}

async function main(): Promise<void> {
  const chosen = options(process.argv.slice(2));
  const token = await accessToken();
  const ctx = await discover(token, chosen, new Date());
  const week = await recordWeek(token, ctx.leagueKey);
  const texts = outputs(ctx, week, await recordAll(ctx, token));
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  for (const [file, text] of texts) {
    await mkdir(join(OUTPUT_DIR, file, ".."), { recursive: true });
    await writeFile(join(OUTPUT_DIR, file), text);
  }
  for (const ticket of browserSteps(ctx).keys()) {
    await mkdir(join(OUTPUT_DIR, ticket, "browser"), { recursive: true });
  }
  console.log(
    `Wrote ${texts.size} files to ${OUTPUT_DIR}/. Next: the browser checklists in each ticket's README.md.`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
