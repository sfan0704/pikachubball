// The website pages and screenshots the research tickets asked for, which the API
// can't give, as a checklist with this league's URLs filled in.
import type { ResearchContext } from "./plan";

const SITE = "https://basketball.fantasysports.yahoo.com/nba";

/** One page to open and save into the ticket's browser/ folder. */
export interface BrowserStep {
  label: string;
  what: string;
  url?: string;
  saveAs: string;
}

function ids(ctx: ResearchContext): { league: string; team: string } {
  const [, league = ""] = ctx.leagueKey.split(".l.");
  const team = ctx.teamKey.split(".t.")[1] ?? "";
  return { league, team };
}

function fan92(ctx: ResearchContext): BrowserStep[] {
  const { league, team } = ids(ctx);
  return [
    {
      label: "1",
      what: "Your roster today, while a game is live (the Opp / status column)",
      url: `${SITE}/${league}/${team}`,
      saveAs: "1-roster-today.har",
    },
    {
      label: "2",
      what: "Your roster tomorrow",
      url: `${SITE}/${league}/${team}?date=${ctx.tomorrow}`,
      saveAs: "2-roster-tomorrow.har",
    },
    {
      label: "3",
      what: "This week's matchup page",
      url: `${SITE}/${league}/matchup?week=${ctx.currentWeek}&mid1=${team}`,
      saveAs: "3-matchup.har",
    },
    {
      label: "4",
      what: "Players list (is there an opponent or game column?)",
      url: `${SITE}/${league}/players?status=ALL`,
      saveAs: "4-players.har",
    },
    {
      label: "5",
      what: "Click one player on that list to open the player card",
      saveAs: "5-player-card.har",
    },
    {
      label: "6",
      what: "Yahoo Sports scoreboard today, then switch to tomorrow",
      url: "https://sports.yahoo.com/nba/scoreboard/",
      saveAs: "6-scoreboard.har",
    },
  ];
}

function fan93(): BrowserStep[] {
  return [
    {
      label: "8",
      what: "Screenshot of the first sample player's Yahoo player page showing Season, Last 7 and Last 30, as totals and as averages (see README for the player key). Take it right after the capture runs.",
      saveAs: "8-player-page-totals.png and 8-player-page-averages.png",
    },
  ];
}

function fan94(ctx: ResearchContext): BrowserStep[] {
  const { league } = ids(ctx);
  const list = `${SITE}/${league}/players?status=ALL&pos=P&cut_type=33&stat1=S_PS7&myteam=0&sort=OR&sdir=1`;
  return [
    {
      label: "B1",
      what: "Next 7 projected list, page 1 and page 2, saved as HTML (right-click → Save Page As → HTML only)",
      url: `${list}&count=0 and ${list}&count=25`,
      saveAs: "B1-page-1.html and B1-page-2.html",
    },
    {
      label: "B2",
      what: "Page 1 again in its JSON form",
      url: `${list}&count=0&jsenabled=1`,
      saveAs: "B2-page-1.har",
    },
    {
      label: "B3",
      what: "Page 1 in a private window, signed out: does it load or ask you to sign in? A screenshot is enough",
      url: `${list}&count=0`,
      saveAs: "B3-signed-out.png",
    },
    {
      label: "B4",
      what: "Write down any footnote on the page about GP* or the projection's date range and source",
      saveAs: "B4-notes.txt",
    },
  ];
}

function fan95(ctx: ResearchContext): BrowserStep[] {
  const { league } = ids(ctx);
  const buzz = (date: string, sort: string): string =>
    `https://basketball.fantasysports.yahoo.com/nba/buzzindex?date=${date}&pos=ALL&src=combined&bimtab=A&trendtab=O&sort=${sort}&sdir=1`;
  return [
    {
      label: "W1",
      what: "Research tab: page 1, then click Next 25",
      url: `${SITE}/${league}/players?status=ALL&pos=P&stat1=R_O&jsenabled=1`,
      saveAs: "W1-research.har",
    },
    {
      label: "W2",
      what: 'Buzz index, most added and most dropped, for today and yesterday; note the page\'s "as of" or date label',
      url: `${buzz(ctx.today, "BI_A")} (then sort=BI_D, then date=${ctx.yesterday})`,
      saveAs: "W2-buzz.har",
    },
    {
      label: "W3",
      what: 'Screenshot of one player on waivers showing the website label, such as "W (Nov 9)"; write the player\'s name in the file name',
      saveAs: "W3-waiver-<player>.png",
    },
  ];
}

/** The browser-only captures, by ticket. FAN-91 and FAN-96 need none. */
export function browserSteps(ctx: ResearchContext): Map<string, BrowserStep[]> {
  return new Map([
    ["FAN-92", fan92(ctx)],
    ["FAN-93", fan93()],
    ["FAN-94", fan94(ctx)],
    ["FAN-95", fan95(ctx)],
  ]);
}
