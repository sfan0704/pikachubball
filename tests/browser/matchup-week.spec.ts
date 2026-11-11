import type { Locator, Page } from "@playwright/test";
import {
  LEAGUE,
  MY_TEAM,
  accessibilityViolations,
  setScenario,
  signIn,
  expect,
  test,
} from "./support";

/** The fixture's swap of slot-10 players falls in the week before the current one (week 5). */
const SWAP_WEEK = 4;
const MY_TEAM_NUMBER = 11;

function playerKey(slot: number): string {
  return `466.p.${10000 + MY_TEAM_NUMBER * 100 + slot}`;
}

const DROPPED = `466.p.${10000 + MY_TEAM_NUMBER * 100 + 50}`;

test.beforeEach(async () => {
  await setScenario("ok");
});

async function openWeek(page: Page, week?: number): Promise<void> {
  await signIn(page, "a", "Matchup");
  await page.getByRole("navigation", { name: "Day" }).getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL(/\/matchup\/week$/);
  if (week !== undefined) {
    await page.getByLabel("Week").selectOption(String(week));
    await expect(page).toHaveURL(new RegExp(`/matchup/week/${week}$`));
  }
  await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
}

function card(column: Locator, key: string): Locator {
  return column.getByTestId(`week-card-${key}`);
}

/** The sum of a column's counted values; "–" means nothing counted. */
async function columnSum(column: Locator): Promise<number> {
  const values = await column.getByTestId("card-value").allTextContents();
  return values.filter((value) => value !== "–").reduce((sum, value) => sum + Number(value), 0);
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
}

test("a past week labels the added, dropped, partly and fully benched players", async ({
  page,
}) => {
  await openWeek(page, SWAP_WEEK);
  const column = page.getByTestId(`column-${MY_TEAM}`);

  await expect(card(column.getByTestId("week-roster"), playerKey(10))).toContainText("Added Sat");
  const dropped = card(column.getByTestId("week-dropped"), DROPPED);
  await expect(dropped).toContainText("Dropped Sat");
  await expect(dropped.getByTestId("card-value")).not.toHaveText("–");
  await expect(card(column, playerKey(11)).getByTestId("card-meta")).toHaveText(
    /^1 of \d G counted$/
  );
  await expect(card(column, playerKey(12)).getByTestId("card-meta")).toHaveText("Benched");
  await expect(card(column, playerKey(12)).getByTestId("card-value")).toHaveText("–");
  // No bench in a week: only the player on IL is set apart.
  await expect(column.getByTestId("week-out").getByRole("listitem")).toHaveCount(1);
  await expect(card(column.getByTestId("week-out"), playerKey(13))).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("each column's counted values add up to the grid's team totals", async ({ page }) => {
  await openWeek(page, SWAP_WEEK);
  const opponent = await page.getByLabel("Opponent").inputValue();
  for (const category of ["PTS", "REB", "3PM"]) {
    await page
      .getByTestId("totals-grid")
      .getByRole("button", { name: new RegExp(`^${category}`) })
      .click();
    await expect(page.getByTestId("columns-title")).toHaveText(`${category} · Week ${SWAP_WEEK}`);
    const key = category === "3PM" ? "tpm" : category.toLowerCase();
    for (const [team, side] of [
      [MY_TEAM, "mine"],
      [opponent, "theirs"],
    ] as const) {
      const total = await page.getByTestId(`grid-${side}-${key}`).textContent();
      expect(await columnSum(page.getByTestId(`column-${team}`))).toBe(Number(total));
    }
  }
});

test("the week picker keeps the week in the URL and comes back to this week", async ({ page }) => {
  await openWeek(page, SWAP_WEEK);
  await page.reload();
  await expect(page.getByLabel("Week")).toHaveValue(String(SWAP_WEEK));

  await page.getByLabel("Week").selectOption("5");
  await expect(page).toHaveURL(/\/matchup\/week$/);
  await expect(page.getByTestId(`column-${MY_TEAM}`)).toBeVisible();
  await expect(page.getByLabel("Week").locator("option")).toHaveCount(5);
});

test("a week that hasn't started says so", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await page.goto(`/leagues/${LEAGUE}/teams/${MY_TEAM}/matchup/week/9`);
  await expect(page.getByTestId("matchup-week")).toHaveText("Week 9 hasn't started.");
});

test("a past week has no WCAG 2.1 AA violations", async ({ page }) => {
  await openWeek(page, SWAP_WEEK);
  expect(await accessibilityViolations(page)).toEqual([]);
});
