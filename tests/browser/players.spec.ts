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

test("lists not-owned players with a waiver row, an inactive row and a <1% row", async ({
  page,
}) => {
  await openPlayers(page);

  await expect(page.getByTestId("players-range")).toHaveText(
    "Players 1–25 · Season average per game"
  );
  const waiver = rows(page)
    .getByTestId("ownership")
    .filter({ hasText: /^Waivers until \w{3}$/ });
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
  await expect(rows(page).filter({ hasText: "Waivers until" })).toHaveCount(0);
});

test("searches and filters by position, including a composite slot", async ({ page }) => {
  await openPlayers(page);

  await page.getByRole("searchbox", { name: "Search players" }).fill("Rivers 30");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Rivers 30");
  await page.getByRole("searchbox", { name: "Search players" }).fill("");
  await expect(rows(page)).toHaveCount(25);

  await page.getByLabel("Position").selectOption("G");
  await expect(rows(page).first()).toBeVisible();
  for (const meta of await rows(page).getByRole("button").allTextContents()) {
    expect(meta).toMatch(/PG|SG/);
  }
  await page.getByLabel("Position").selectOption("C");
  for (const meta of await rows(page).getByRole("button").allTextContents()) {
    expect(meta).toMatch(/\bC\b/);
  }
});

test("filters by NBA team, tonight, tomorrow, back-to-back and games left", async ({ page }) => {
  await openPlayers(page);
  const schedule = page.getByRole("group", { name: "Schedule" });

  // In the fixture DEN and MIA play tonight and tomorrow; PHX plays only tomorrow.
  await page.getByLabel("NBA team").selectOption("PHX");
  await expect(rows(page).first()).toContainText("PHX");
  await schedule.getByRole("button", { name: "Tonight" }).click();
  await expect(page.getByText("No players on this page match these filters.")).toBeVisible();
  await schedule.getByRole("button", { name: "Tomorrow" }).click();
  await expect(rows(page).first()).toContainText("PHX");

  await page.getByLabel("NBA team").selectOption("");
  await schedule.getByRole("button", { name: "B2B" }).click();
  await expect(rows(page).first()).toBeVisible();
  for (const meta of await rows(page).getByRole("button").allTextContents()) {
    expect(meta).toMatch(/DEN|MIA/);
  }

  await schedule.getByRole("button", { name: "Any day" }).click();
  // The fixture's week varies with the day the tests run, so ask only for one game left.
  await page.getByLabel("Games left").selectOption("1");
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
    ["Last 7", "Last 7 days, average per game"],
    ["Last 30", "Last 30 days, average per game"],
    ["Season", "Season average per game"],
  ] as const) {
    await stats.getByRole("button", { name: label }).click();
    await expect(stats.getByRole("button", { name: label })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("players-range")).toContainText(caption);
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
  });
}
