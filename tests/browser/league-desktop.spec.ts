import type { Page } from "@playwright/test";
import {
  LEAGUE,
  MY_TEAM,
  accessibilityViolations,
  setScenario,
  signIn,
  useTheme,
  expect,
  test,
} from "./support";

/** League laid out for a computer (FAN-154): both tables, the picked team's details and its roster. */

const TEAM_9 = `${LEAGUE}.t.9`;
const LUCK = /^([+−]\d+\.\d|0)$/;
const DESKTOP = { tag: "@desktop" } as const;

test.beforeEach(async () => {
  await setScenario("ok");
});

const panel = (page: Page) => page.getByTestId("team-panel");
const roster = (page: Page) => page.getByTestId("card-league-roster");

/** The rows outlined as picked, in page order. */
async function pickedRows(page: Page): Promise<(string | null)[]> {
  const rows = page.getByRole("row", { selected: true });
  return rows.evaluateAll((elements) => elements.map((row) => row.getAttribute("data-testid")));
}

async function leagueLoaded(page: Page): Promise<void> {
  await expect(page.getByTestId(`standings-row-${MY_TEAM}`).getByTestId("row-luck")).toHaveText(
    LUCK
  );
  await expect(roster(page).getByTestId("popover-player").first()).toContainText(/\d\.\d PTS/);
}

async function box(page: Page, testId: string) {
  const found = await page.getByTestId(testId).boundingBox();
  if (!found) {
    throw new Error(`${testId} is not on the page`);
  }
  return found;
}

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test(
  "shows Standings, Categories and my team's details side by side, my team outlined without a URL change",
  DESKTOP,
  async ({ page }) => {
    await signIn(page);
    await leagueLoaded(page);
    await expect(page).toHaveURL(/\/season$/);
    await expect(page.getByRole("navigation", { name: "League view" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Standings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
    await expect(page.getByTestId(/^standings-row-/)).toHaveCount(14);
    await expect(page.getByTestId(/^grid-row-/)).toHaveCount(14);
    expect(await pickedRows(page)).toEqual([`standings-row-${MY_TEAM}`, `grid-row-${MY_TEAM}`]);
    await expect(panel(page).getByTestId("luck-line")).toHaveCount(3);
    await expect(panel(page).getByTestId("category-all-play")).toBeVisible();
    await expect(roster(page).getByTestId("popover-player")).toHaveCount(13);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The three cards share a top edge, and the roster sits below them across the page.
    const [standings, categories, details, rosterCard] = await Promise.all(
      ["card-league-standings", "card-league-categories", "team-panel", "card-league-roster"].map(
        (id) => box(page, id)
      )
    );
    expect([categories.y, details.y]).toEqual([standings.y, standings.y]);
    expect(standings.x + standings.width).toBeLessThan(categories.x);
    expect(categories.x + categories.width).toBeLessThan(details.x);
    expect(rosterCard.y).toBeGreaterThan(standings.y + standings.height);
    expect(rosterCard.width).toBeCloseTo(details.x + details.width - standings.x, 0);
  }
);

test(
  "sorts and picks a category into the URL as on the phone, keeping the picked team in view",
  DESKTOP,
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await signIn(page);
    await leagueLoaded(page);

    await page.getByRole("button", { name: "Luck" }).click();
    await expect(page).toHaveURL(/\/season\?sort=luck$/);
    await expect(page.getByTestId(`standings-row-${MY_TEAM}`)).toBeInViewport();
    await page.getByRole("button", { name: "TO", exact: true }).click();
    await expect(page).toHaveURL(/\/season\?sort=luck&category=19$/);
    await expect(page.getByTestId("row-total")).toHaveCount(14);
    await expect(page.getByTestId(`grid-row-${MY_TEAM}`)).toBeInViewport();

    await page.goBack();
    await expect(page).toHaveURL(/\/season\?sort=luck$/);
    await expect(page.getByTestId("row-total")).toHaveCount(0);
    await page.goForward();
    await expect(page.getByTestId("row-total")).toHaveCount(14);
  }
);

test(
  "ignores the URL's view from md but keeps it, so narrowing returns to it",
  DESKTOP,
  async ({ page }) => {
    await signIn(page);
    await page.getByLabel("Period").selectOption("current");
    await page.goto(`${new URL(page.url()).pathname}?view=categories`);
    await expect(page.getByRole("table", { name: "Standings" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Category ranks" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("table", { name: "Standings" })).toHaveCount(0);
    await expect(page.getByRole("table", { name: "Category ranks" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/current\?view=categories$/);
  }
);

test("picks a team in either table and follows a period change", DESKTOP, async ({ page }) => {
  await signIn(page);
  await leagueLoaded(page);

  await page.getByTestId(`grid-team-${TEAM_9}`).click();
  expect(await pickedRows(page)).toEqual([`standings-row-${TEAM_9}`, `grid-row-${TEAM_9}`]);
  await expect(page.getByRole("region", { name: "Team 9", exact: true })).toBeVisible();
  await expect(roster(page).getByRole("heading")).toHaveText(/^Roster · Team 9$/i);
  await expect(page).toHaveURL(/\/season$/);

  await page.getByLabel("Period").selectOption("1");
  await expect(page).toHaveURL(/\/1$/);
  await expect(page.getByRole("region", { name: "Team 9", exact: true })).toContainText(
    /^Team 9Week 1 · /
  );
  await expect(panel(page).getByTestId("luck-line")).toHaveCount(3);
  await expect(panel(page).getByTestId("category-all-play")).toHaveCount(0);
});

test("opens a roster player's details in the drawer from the right", DESKTOP, async ({ page }) => {
  await signIn(page);
  await leagueLoaded(page);
  const first = roster(page).getByRole("button").first();
  const name = (await first.locator("span span").first().textContent())?.trim() ?? "";

  await first.click();
  const drawer = page.getByTestId("player-detail");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading").first()).toContainText(name);
  // Its right edge on the window's, once it has slid in.
  await expect
    .poll(async () => {
      const found = await drawer.boundingBox();
      return found && Math.round(found.x + found.width);
    })
    .toBe(1280);
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(first).toBeFocused();
});

/** The API paths the page asks for, with their queries. */
function recordApiCalls(page: Page): Set<string> {
  const calls = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/leagues/")) {
      calls.add(`${url.pathname}${url.search}`);
    }
  });
  return calls;
}

test("asks for the same data as the phone with my team's sheet open", DESKTOP, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const phone = recordApiCalls(page);
  await page.reload();
  await page.getByTestId(`row-ranking-${MY_TEAM}`).click();
  await expect(page.getByTestId("popover-player").first()).toContainText(/\d\.\d PTS/);
  await page.waitForLoadState("networkidle");
  page.removeAllListeners("request");

  await page.setViewportSize({ width: 1280, height: 800 });
  const desktop = recordApiCalls(page);
  await page.reload();
  await leagueLoaded(page);
  await page.waitForLoadState("networkidle");

  expect(phone.size).toBeGreaterThan(0);
  expect([...desktop].sort()).toEqual([...phone].sort());
});

test("never scrolls the page sideways from 320 to 1920 px", DESKTOP, async ({ page }) => {
  await signIn(page);
  await leagueLoaded(page);
  for (const width of [320, 390, 767, 768, 900, 1099, 1100, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await sidewaysOverflow(page), `${width}px`).toBeLessThanOrEqual(0);
  }
});

test(
  "reaches every control by keyboard in reading order, each with a focus ring",
  DESKTOP,
  async ({ page }) => {
    await signIn(page);
    await leagueLoaded(page);
    await page.getByLabel("Period").focus();
    const order: string[] = [];
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        // Past the last control on the page, focus leaves League.
        if (!element?.closest("main")) {
          return null;
        }
        const style = window.getComputedStyle(element);
        return {
          id:
            element.dataset.testid ??
            element.getAttribute("aria-label") ??
            element.textContent?.trim().slice(0, 20) ??
            "",
          ring: style.boxShadow !== "none" || style.outlineStyle !== "none",
        };
      });
      if (!focused) {
        break;
      }
      expect(focused.ring, `focus ring on ${focused.id}`).toBe(true);
      order.push(focused.id);
    }
    const at = (id: string) => order.indexOf(id);
    const landmarks = [
      "How to read this",
      "W–L–T",
      `row-ranking-${MY_TEAM}`,
      "FG%",
      `grid-team-${MY_TEAM}`,
    ];
    for (const id of landmarks) {
      expect(at(id), `${id} is reachable`).toBeGreaterThanOrEqual(0);
    }
    expect(landmarks.map(at)).toEqual([...landmarks.map(at)].sort((a, b) => a - b));
  }
);

for (const theme of ["light", "dark"] as const) {
  test(
    `passes accessibility checks with the picked row announced as selected (${theme})`,
    DESKTOP,
    async ({ page }) => {
      await useTheme(page, theme);
      await signIn(page);
      await leagueLoaded(page);
      await expect(page.getByRole("row", { selected: true })).toHaveCount(2);
      expect(await accessibilityViolations(page)).toEqual([]);

      await page.getByTestId(`row-ranking-${TEAM_9}`).click();
      await page.getByRole("button", { name: "PTS", exact: true }).click();
      await expect(page.getByTestId("row-total")).toHaveCount(14);
      await expect(roster(page).getByTestId("popover-player").first()).toContainText(/\d\.\d PTS/);
      expect(await accessibilityViolations(page)).toEqual([]);
    }
  );
}

test.describe("a league of another shape", () => {
  test.beforeEach(async () => {
    await setScenario("ok", undefined, "12x10");
  });
  test.afterEach(async () => {
    await setScenario("ok");
  });

  for (const width of [1100, 1280]) {
    test(
      `keeps twelve teams and ten categories inside their cards at ${width}px`,
      DESKTOP,
      async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await signIn(page);
        await expect(page.getByTestId(/^standings-row-/)).toHaveCount(12);
        await expect(
          page.getByRole("table", { name: "Category ranks" }).getByRole("columnheader")
        ).toHaveCount(11);
        await expect(
          panel(page).getByRole("list", { name: "Category ranks and totals" }).getByRole("listitem")
        ).toHaveCount(10);
        expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
        const tops = await Promise.all(
          ["card-league-standings", "card-league-categories", "team-panel"].map(
            async (id) => (await box(page, id)).y
          )
        );
        expect(new Set(tops).size).toBe(1);
      }
    );
  }
});
