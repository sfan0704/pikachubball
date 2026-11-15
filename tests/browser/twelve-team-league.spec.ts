import type { Locator, Page } from "@playwright/test";
import { MY_TEAM, accessibilityViolations, setScenario, signIn, expect, test } from "./support";

/**
 * Matchup and Players for a league that isn't the standard nine: twelve teams
 * and ten categories (3PT% in place of 3PM, and PF), at phone width.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: "America/New_York" });

const TEN_CATEGORIES = ["FG%", "FT%", "3PT%", "PTS", "REB", "AST", "STL", "BLK", "TO", "PF"];

test.beforeEach(async () => {
  await setScenario("ok", undefined, "12x10");
});

test.afterEach(async () => {
  await setScenario("ok");
});

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
}

/** How many separate rows the elements sit in, by their top edge. */
async function rowCount(items: Locator): Promise<number> {
  const tops = await items.evaluateAll((elements) =>
    elements.map((element) => Math.round(element.getBoundingClientRect().top))
  );
  return new Set(tops).size;
}

async function expectTenCategoryGrid(page: Page): Promise<Locator> {
  const grid = page.getByTestId("totals-grid");
  const buttons = grid.getByRole("button");
  await expect(buttons).toHaveCount(10);
  for (const label of TEN_CATEGORIES) {
    await expect(grid.getByRole("button", { name: new RegExp(`^${label},`) })).toBeVisible();
  }
  await expect(grid.getByRole("button", { name: /^3PM,/ })).toHaveCount(0);
  // Ten categories sit in two rows of five, each still readable at phone width.
  expect(await rowCount(buttons)).toBe(2);
  return grid;
}

test("Matchup Today follows the league's ten categories at phone width", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
  await expect(page.getByTestId("matchup-score")).toHaveText(/^\d+–\d+–\d+/);
  const grid = await expectTenCategoryGrid(page);

  await grid.getByRole("button", { name: /^PF,/ }).click();
  await expect(page.getByTestId("columns-title")).toHaveText("PF · Today");
  const fouls = (
    await page.getByTestId(`column-${MY_TEAM}`).getByTestId("card-value").allTextContents()
  )
    .filter((value) => /^\d+$/.test(value))
    .map(Number)
    .slice(0, 4);
  // Fewer fouls is better, so the counted players run fewest first.
  expect(fouls).toEqual([...fouls].sort((a, b) => a - b));

  await expectNoHorizontalScroll(page);
  expect(await accessibilityViolations(page)).toEqual([]);
});

test("Matchup Week follows the league's ten categories at phone width", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await page.getByRole("navigation", { name: "Day" }).getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL(/\/matchup\/week$/);
  await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
  const grid = await expectTenCategoryGrid(page);
  await grid.getByRole("button", { name: /^3PT%,/ }).click();
  await expect(page.getByTestId("columns-title")).toHaveText(/^3PT%/);

  await expectNoHorizontalScroll(page);
  expect(await accessibilityViolations(page)).toEqual([]);
});

test("Players shows and sorts by the league's ten categories at phone width", async ({ page }) => {
  await signIn(page, "a", "Players");
  const rows = page.getByTestId("players-list").getByRole("listitem");
  await expect(rows).toHaveCount(25);
  const averages = rows.first().getByTestId("player-averages");
  await expect(averages).not.toContainText("—");
  await expect(averages.locator("dt")).toHaveText(TEN_CATEGORIES);
  expect(await rowCount(averages.locator("dt"))).toBe(2);

  await page.getByLabel("Sort by").selectOption({ label: "PF" });
  const fouls = await rows
    .getByTestId("player-averages")
    .evaluateAll((lists) =>
      lists.map((list) => Number(list.querySelectorAll("dd")[9]?.textContent))
    );
  expect(fouls).toEqual([...fouls].sort((a, b) => a - b));

  await expectNoHorizontalScroll(page);
  expect(await accessibilityViolations(page)).toEqual([]);
});
