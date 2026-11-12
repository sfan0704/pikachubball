import type { Page } from "@playwright/test";
import { accessibilityViolations, setScenario, signIn, useTheme, expect, test } from "./support";

// Tonight and tomorrow follow the viewer's time zone; the fixture's games tip off at 6:30 pm Eastern.
test.use({ timezoneId: "America/New_York" });

test.beforeEach(async () => {
  await setScenario("ok");
});

function rows(page: Page) {
  return page.getByTestId("players-list").getByRole("listitem");
}

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Opens Players and waits for the page and its averages. */
async function openPlayers(page: Page) {
  await signIn(page, "a", "Players");
  await expect(rows(page)).toHaveCount(25);
  await expect(rows(page).first().getByTestId("player-averages")).not.toContainText("—");
}

/** Picks a position in the Filters sheet and closes it. */
async function pickPosition(page: Page, position: string) {
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet
    .getByRole("group", { name: "Position" })
    .getByRole("button", { name: position, exact: true })
    .click();
  await sheet.getByRole("button", { name: /^Show \d+ players?$/ }).click();
  await expect(sheet).toBeHidden();
}

/** Picks an NBA team in the Filters sheet ("" for every team) and closes it. */
async function pickNbaTeam(page: Page, team: string) {
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByLabel("NBA team").selectOption(team);
  await sheet.getByRole("button", { name: /^Show \d+ players?$/ }).click();
  await expect(sheet).toBeHidden();
}

/**
 * Waits until the list shows at least one row and every row lists a position
 * matching `position`. Polling rides out the unfiltered rows still on screen
 * while the filtered page loads; matching single positions keeps a name like
 * "Rivers 4C" from passing or failing the check.
 */
async function expectEveryRowPlays(page: Page, position: RegExp) {
  await expect
    .poll(async () => {
      const lists = await rows(page).getByTestId("player-positions").allTextContents();
      return (
        lists.length > 0 && lists.every((list) => list.split(", ").some((p) => position.test(p)))
      );
    })
    .toBe(true);
}

test("lists not-owned players with a waiver row, an inactive row and a <1% row", async ({
  page,
}) => {
  await openPlayers(page);

  await expect(page.getByTestId("players-range")).toHaveText("Players 1–25");
  await expect(page.getByTestId("players-count")).toHaveText("25 players · season avg per game");
  const waiver = rows(page)
    .getByTestId("ownership")
    .filter({ hasText: /^Clears \w{3}$/ });
  await expect(waiver.first()).toBeVisible();
  await expect(
    rows(page).getByTestId("rostered").filter({ hasText: /^<1%/ }).first()
  ).toBeVisible();
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Next 25" }).click();
  await expect(page.getByTestId("players-range")).toContainText("Players 26–44");
  const inactive = rows(page).filter({ hasText: "Inactive" });
  await expect(inactive).toHaveCount(1);
  await expect(inactive.getByTestId("injury-tag")).toHaveText("NA");
  await expect(page.getByRole("button", { name: "Next 25" })).toBeDisabled();
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Previous 25" }).click();
  await expect(page.getByTestId("players-range")).toContainText("Players 1–25");
});

test("shows owned players with their fantasy team", async ({ page }) => {
  await openPlayers(page);

  await page
    .getByRole("group", { name: "List" })
    .getByRole("button", { name: "Owned", exact: true })
    .click();
  await expect(rows(page).first().getByTestId("ownership")).toHaveText(/^Team \d+$/);
  await expect(rows(page).filter({ hasText: "Clears" })).toHaveCount(0);
});

test("searches and filters by position, including a composite slot", async ({ page }) => {
  await openPlayers(page);

  await page.getByRole("searchbox", { name: "Search players" }).fill("Rivers 30");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Rivers 30");
  await page.getByRole("searchbox", { name: "Search players" }).fill("");
  await expect(rows(page)).toHaveCount(25);

  await pickPosition(page, "G");
  await expectEveryRowPlays(page, /^(PG|SG)$/);
  await pickPosition(page, "C");
  await expectEveryRowPlays(page, /^C$/);
});

test("opens the filters sheet, badges what is on and clears it", async ({ page }) => {
  await openPlayers(page);
  const filtersButton = page.getByRole("button", { name: /^Filters/ });
  await expect(filtersButton).toHaveAccessibleName("Filters");

  await filtersButton.click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("NBA team").selectOption("DEN");
  await sheet
    .getByRole("group", { name: "Position" })
    .getByRole("button", { name: "C", exact: true })
    .click();
  await expect(sheet.getByRole("button", { name: /^Show \d+ players?$/ })).toBeVisible();
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  await sheet.getByRole("button", { name: /^Show \d+ players?$/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("filters-badge")).toHaveText("2");
  await expect(filtersButton).toHaveAccessibleName("Filters, 2 on");
  await expectEveryRowPlays(page, /^C$/);
  for (const meta of await rows(page).allTextContents()) {
    expect(meta).toContain("DEN");
  }

  await filtersButton.click();
  await sheet.getByRole("button", { name: "Clear" }).click();
  await sheet.getByRole("button", { name: /^Show \d+ players?$/ }).click();
  await expect(page.getByTestId("filters-badge")).toBeHidden();
  await expect(rows(page)).toHaveCount(25);
});

test("sorts the page by a category and by rostered %", async ({ page }) => {
  await openPlayers(page);
  const sortBy = page.getByLabel("Sort by");

  await sortBy.selectOption({ label: "PTS" });
  const points = await rows(page)
    .getByTestId("player-averages")
    .evaluateAll((lists) =>
      lists.map((list) => Number(list.querySelectorAll("dd")[3]?.textContent))
    );
  expect(points).toEqual([...points].sort((a, b) => b - a));

  await sortBy.selectOption({ label: "Rostered %" });
  const rostered = (await rows(page).getByTestId("rostered").allTextContents()).map((text) =>
    text.startsWith("<1%") ? 0 : Number.parseInt(text, 10)
  );
  expect(rostered).toEqual([...rostered].sort((a, b) => b - a));
  await expect(rows(page)).toHaveCount(25);
});

test("filters by NBA team, tonight, tomorrow, back-to-back and games left", async ({ page }) => {
  await openPlayers(page);
  const schedule = page.getByRole("group", { name: "Schedule" });

  // In the fixture DEN and MIA play tonight and tomorrow; PHX plays only tomorrow.
  await pickNbaTeam(page, "PHX");
  await expect(rows(page).first()).toContainText("PHX");
  await schedule.getByRole("button", { name: "Tonight" }).click();
  await expect(page.getByText("No players on this page match these filters.")).toBeVisible();
  await schedule.getByRole("button", { name: "Tomorrow" }).click();
  await expect(rows(page).first()).toContainText("PHX");

  await pickNbaTeam(page, "");
  await schedule.getByRole("button", { name: "B2B" }).click();
  await expect(rows(page).first()).toBeVisible();
  for (const meta of await rows(page).allTextContents()) {
    expect(meta).toMatch(/· (DEN|MIA)/);
  }

  await schedule.getByRole("button", { name: "Any day" }).click();
  // The fixture's week varies with the day the tests run, so ask only for one game left.
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByLabel("Games left").selectOption("1");
  await sheet.getByRole("button", { name: /^Show \d+ players?$/ }).click();
  const left = await rows(page).getByTestId("games-left").allTextContents();
  expect(left.length).toBeGreaterThan(0);
  for (const text of left) {
    expect(Number.parseInt(text, 10)).toBeGreaterThanOrEqual(1);
  }
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
});

test("switches the stats period", async ({ page }) => {
  await openPlayers(page);
  const stats = page.getByRole("group", { name: "Stats" });

  for (const [label, caption] of [
    ["Last 7", "last 7 days per game"],
    ["Last 30", "last 30 days per game"],
    ["Season", "season avg per game"],
  ] as const) {
    await stats.getByRole("button", { name: label }).click();
    await expect(stats.getByRole("button", { name: label })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("players-count")).toContainText(caption);
    await expect(rows(page).first().getByTestId("player-averages")).not.toContainText("—");
  }
  await expect(stats.getByRole("button")).toHaveCount(3);
});

for (const theme of ["light", "dark"] as const) {
  test(`a waiver and an inactive row have no WCAG 2.1 AA violations (${theme})`, async ({
    page,
  }) => {
    await useTheme(page, theme);
    await openPlayers(page);
    expect(await accessibilityViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "Next 25" }).click();
    await expect(rows(page).filter({ hasText: "Inactive" })).toHaveCount(1);
    expect(await accessibilityViolations(page)).toEqual([]);

    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
  });
}
