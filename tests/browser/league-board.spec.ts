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

test.beforeEach(async () => {
  await setScenario("ok");
});

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

const ORDINAL = /^\d+(st|nd|rd|th)$/;
const LUCK = /^([+−]\d+\.\d|0)$/;

test("ranks Season by Yahoo's record with all-play and luck, and keeps the view across periods", async ({
  page,
}) => {
  await signIn(page);
  const mine = page.getByTestId(`standings-row-${MY_TEAM}`);
  await expect(page).toHaveURL(/\/season$/);
  await expect(page.getByLabel("Period")).toHaveValue("season");
  await expect(page.getByTestId(/^standings-row-/)).toHaveCount(14);
  await expect(mine.getByTestId("row-record")).toHaveText("36–27–0");
  await expect(mine.getByTestId("row-all-play")).toHaveText(ORDINAL);
  await expect(mine.getByTestId("row-luck")).toHaveText(LUCK);
  const ranks = (await page.getByTestId("row-rank").allTextContents()).map(Number);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

  await page.getByLabel("Period").selectOption("1");
  await expect(page).toHaveURL(/\/1$/);
  await expect(mine.getByTestId("row-record")).toHaveText(/^\d+–\d+–\d+$/);
  await expect(mine.getByTestId("row-all-play")).toHaveText(ORDINAL);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
});

test("has one period row at phone width: dated weeks, the ⓘ, and no League or Viewing as select", async ({
  page,
}) => {
  await signIn(page);
  const period = page.getByLabel("Period");
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);

  await expect(page.getByLabel("Viewing as")).toHaveCount(0);
  await expect(page.getByLabel("Time period")).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(1);
  const options = await period.getByRole("option").allTextContents();
  expect(options[0]).toBe("Season totals");
  expect(options[1]).toMatch(/^Week \d+ · \w{3} \d+–(\w{3} )?\d+ \(now\)$/);
  expect(options.at(-1)).toMatch(/^Week 1 · \w{3} \d+–(\w{3} )?\d+$/);

  const info = page.getByRole("button", { name: "How to read this" });
  const [periodBox, infoBox] = [await period.boundingBox(), await info.boundingBox()];
  expect(periodBox && infoBox && Math.abs(periodBox.y - infoBox.y)).toBeLessThanOrEqual(4);
  await info.click();
  await expect(page.getByRole("dialog", { name: "How to read League" })).toBeVisible();
});

test("switches between Standings and Categories in the URL, and back returns", async ({ page }) => {
  await signIn(page);
  const views = page.getByRole("navigation", { name: "League view" });
  await expect(views.getByRole("link", { name: "Standings" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await views.getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/season\?view=categories$/);
  const grid = page.getByRole("table", { name: "Category ranks" });
  await expect(grid.getByRole("columnheader")).toHaveCount(10);
  await expect(page.getByTestId(/^grid-row-/)).toHaveCount(14);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByLabel("Period").selectOption("current");
  await expect(page).toHaveURL(/\/current\?view=categories$/);

  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/season$/);
  await expect(page.getByTestId(/^standings-row-/)).toHaveCount(14);
});

test("sorts Standings by a column header, kept in the URL", async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId(`standings-row-${MY_TEAM}`).getByTestId("row-luck")).toHaveText(
    LUCK
  );

  await page.getByRole("button", { name: "Luck" }).click();
  await expect(page).toHaveURL(/\/season\?sort=luck$/);
  await expect(page.getByRole("columnheader", { name: "Luck" })).toHaveAttribute(
    "aria-sort",
    "descending"
  );
  const luck = (await page.getByTestId("row-luck").allTextContents()).map((text) =>
    Number(text.replace("−", "-"))
  );
  expect(luck).toEqual([...luck].sort((a, b) => b - a));

  await page.getByRole("button", { name: "All-play" }).click();
  await expect(page).toHaveURL(/\/season\?sort=all-play$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/season\?sort=luck$/);
  await expect(page.getByRole("columnheader", { name: "Luck" })).toHaveAttribute(
    "aria-sort",
    "descending"
  );
});

test("picks a category in the grid: tied teams share a rank, and a second tap clears it", async ({
  page,
}) => {
  await signIn(page);
  await page.getByLabel("Period").selectOption("current");
  await page
    .getByRole("navigation", { name: "League view" })
    .getByRole("link", { name: "Categories" })
    .click();

  await page.getByRole("button", { name: "TO", exact: true }).click();
  await expect(page).toHaveURL(/\/current\?view=categories&category=19$/);
  await expect(page.getByTestId("row-total")).toHaveCount(14);
  // Three teams share 11th in turnovers this week; the next rank is skipped.
  const column = page.getByTestId(/^grid-row-/).locator("td:last-child");
  await expect(column).toHaveText([
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

  await page.getByRole("button", { name: "TO", exact: true }).click();
  await expect(page).toHaveURL(/\/current\?view=categories$/);
  await expect(page.getByTestId("row-total")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("row-total")).toHaveCount(14);
});

test("opens a team's standing, luck, ranks and roster, and closes it again", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("Period").selectOption("current");

  await page.getByTestId(`row-ranking-${LEAGUE}.t.9`).click();
  const popover = page.getByRole("dialog", { name: "Team 9" });
  await expect(popover).toContainText(/^Team 9Week \d+ · /);
  await expect(popover.getByTestId("team-summary")).toContainText(
    /Standing\d+(st|nd|rd|th)\d+–\d+–\d+All-play\d+(st|nd|rd|th)\d+–\d+–\d+Luck([+−]\d+\.\d|0)category wins/
  );
  await expect(popover.getByTestId("luck-line")).toHaveCount(3);
  await expect(popover.getByTestId("category-all-play")).toHaveCount(0);
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
  test(`both views, the explanation and the team popover pass accessibility checks (${theme})`, async ({
    page,
  }) => {
    await useTheme(page, theme);
    await signIn(page);
    await expect(page.getByTestId(`standings-row-${MY_TEAM}`).getByTestId("row-luck")).toHaveText(
      LUCK
    );
    expect(await accessibilityViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "How to read this" }).click();
    await expect(page.getByRole("dialog", { name: "How to read League" })).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await page.getByTestId(`row-ranking-${MY_TEAM}`).click();
    await expect(page.getByTestId("popover-player").first()).toContainText(/\d\.\d PTS/);
    expect(await accessibilityViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await page
      .getByRole("navigation", { name: "League view" })
      .getByRole("link", { name: "Categories" })
      .click();
    await page.getByRole("button", { name: "PTS", exact: true }).click();
    await expect(page.getByTestId("row-total")).toHaveCount(14);
    expect(await accessibilityViolations(page)).toEqual([]);
  });
}
