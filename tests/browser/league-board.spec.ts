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

const TILES = ["Overall", "FG%", "FT%", "3PM", "PTS", "REB", "AST", "STL", "BLK", "TO"];

test.beforeEach(async () => {
  await setScenario("ok");
});

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test("switches the period and keeps Yahoo's season record beside each team", async ({ page }) => {
  await signIn(page);
  const mine = page.getByTestId(`row-ranking-${MY_TEAM}`);
  await expect(page.getByTestId("board-title")).toHaveText("Overall");
  await expect(mine.getByTestId("row-value")).toHaveText("36–27–0");

  await page.getByLabel("Time period").selectOption("season");
  await expect(page).toHaveURL(/\/season$/);
  await expect(page.getByTestId("tile-overall")).toContainText("4");
  await expect(mine).toContainText("47.9%");

  await page.getByLabel("Time period").selectOption("1");
  await expect(page).toHaveURL(/\/1$/);
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
  await expect(mine.getByTestId("row-value")).toHaveText("36–27–0");
});

test("every tile selects its ranking without scrolling sideways", async ({ page }) => {
  await signIn(page);

  const tiles = page.getByRole("group", { name: "Rank by" }).getByRole("button");
  await expect(tiles).toHaveCount(TILES.length);
  for (const [index, label] of TILES.entries()) {
    const tile = tiles.nth(index);
    await expect(tile).toContainText(label);
    await tile.click();
    await expect(tile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("board-title")).toHaveText(label);
    await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
    expect(await sidewaysOverflow(page), `overflows on ${label}`).toBeLessThanOrEqual(0);
  }
});

test("tied teams share a rank and the next one is skipped", async ({ page }) => {
  await signIn(page);

  // This week two teams have the same rank sum, and three share a TO rank.
  await expect(page.getByTestId("row-rank")).toHaveText([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "8",
    "10",
    "11",
    "12",
    "13",
    "14",
  ]);
  await page.getByTestId("tile-to").click();
  await expect(page.getByTestId("row-rank")).toHaveText([
    "1",
    "2",
    "3",
    "4",
    "4",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "11",
    "11",
    "14",
  ]);
});

test("opens a team's ranks and roster, and closes it again", async ({ page }) => {
  await signIn(page);

  await page.getByTestId(`row-ranking-${LEAGUE}.t.9`).click();
  const popover = page.getByRole("dialog", { name: "Team 9" });
  await expect(popover).toContainText("ranks for this week");
  await expect(
    popover.getByRole("list", { name: "Category ranks and totals" }).getByRole("listitem")
  ).toHaveCount(9);
  await expect(popover.getByTestId("popover-player")).toHaveCount(13);
  await expect(popover.getByTestId("popover-player").first()).toContainText("Round 1");
  await expect(popover).toContainText("Waivers $4");
  await expect(popover).toContainText("Free agent");
  await expect(popover.getByTestId("popover-player").first()).toContainText(/\d\.\d PTS/);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(page.getByTestId(`row-ranking-${LEAGUE}.t.9`)).toBeFocused();
});

for (const theme of ["light", "dark"] as const) {
  test(`the board, its explanation and the team popover pass accessibility checks (${theme})`, async ({
    page,
  }) => {
    await useTheme(page, theme);
    await signIn(page);
    await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
    expect(await accessibilityViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "How to read this" }).click();
    await expect(page.getByRole("dialog", { name: "Category ranks" })).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await page.getByTestId(`row-ranking-${MY_TEAM}`).click();
    await expect(page.getByTestId("popover-player").first()).toContainText(/\d\.\d PTS/);
    expect(await accessibilityViolations(page)).toEqual([]);
  });
}
