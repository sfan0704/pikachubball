import type { Page } from "@playwright/test";
import { LEAGUE, MY_TEAM, setScenario, signIn, expect, test } from "./support";

test.beforeEach(async () => {
  await setScenario("ok");
});

/** The values shown in one team's column, top to bottom. */
async function columnValues(page: Page, teamKey: string): Promise<string[]> {
  return page.getByTestId(`column-${teamKey}`).getByTestId("card-value").allTextContents();
}

async function opponentKey(page: Page): Promise<string> {
  return page.getByLabel("Opponent").inputValue();
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
}

test("Today shows the week's score, the grid and both rosters with every game state", async ({
  page,
}) => {
  await signIn(page, "a", "Matchup");
  await expect(page.getByTestId("matchup-score")).toHaveText(/^\d+–\d+–\d+/);
  await expect(page.getByTestId("totals-grid").getByRole("button")).toHaveCount(9);
  await expect(page.getByTestId("freshness")).toHaveAttribute("data-state", "live");

  const column = page.getByTestId(`column-${MY_TEAM}`);
  await expect(column.getByTestId("counted-players").getByRole("listitem")).toHaveCount(10);
  await expect(column.getByTestId("bench-players").getByRole("listitem")).toHaveCount(3);
  // Live with quarter and clock, final with the score, not started with the tip-off, no game, out.
  await expect(column.getByText(/Q3 7:48/).first()).toBeVisible();
  await expect(column.getByText(/[WL] \d+–\d+/).first()).toBeVisible();
  await expect(column.getByText(/\d+:\d\d [AP]M ET/).first()).toBeVisible();
  await expect(column.getByText("GTD")).toBeVisible();
  const values = await columnValues(page, MY_TEAM);
  for (const state of ["n/a", "–", "No game", "DNP", "Out"]) {
    expect(values).toContain(state);
  }
  await expectNoHorizontalScroll(page);
});

test("picking a category re-sorts each column on its own", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  const grid = page.getByTestId("totals-grid");
  await grid.getByRole("button", { name: /^PTS/ }).click();
  await expect(grid.getByRole("button", { name: /^PTS/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("columns-title")).toHaveText("PTS · Today");

  const counts = async (teamKey: string) =>
    (await columnValues(page, teamKey)).filter((value) => /^\d+$/.test(value)).map(Number);
  for (const team of [MY_TEAM, await opponentKey(page)]) {
    const points = await counts(team);
    expect(points.length).toBeGreaterThan(0);
    // Counted players come first, most points first; bench values follow on their own.
    const counted = points.slice(0, 4);
    expect(counted).toEqual([...counted].sort((a, b) => b - a));
  }

  await grid.getByRole("button", { name: /^TO/ }).click();
  const turnovers = (await counts(MY_TEAM)).slice(0, 4);
  expect(turnovers).toEqual([...turnovers].sort((a, b) => a - b));
});

test("switching the opponent says it isn't the real matchup", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  const real = await opponentKey(page);
  await expect(page.getByTestId("not-your-matchup")).toHaveCount(0);

  const other = `${LEAGUE}.t.${real.endsWith(".t.1") ? 2 : 1}`;
  await page.getByLabel("Opponent").selectOption(other);
  await expect(page.getByTestId("not-your-matchup")).toBeVisible();
  await expect(page.getByTestId(`column-${other}`)).toBeVisible();

  await page.getByLabel("Opponent").selectOption(real);
  await expect(page.getByTestId("not-your-matchup")).toHaveCount(0);
});

test("Yesterday shows final games, no injury tags and keeps the opponent", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  const other = `${LEAGUE}.t.1`;
  await page.getByLabel("Opponent").selectOption(other);

  await page
    .getByRole("navigation", { name: "Day" })
    .getByRole("link", { name: "Yesterday" })
    .click();
  await expect(page).toHaveURL(/\/matchup\/yesterday$/);
  await expect(page.getByTestId("columns-title")).not.toContainText("Today");
  await expect(page.getByTestId("freshness")).toHaveAttribute("data-state", "final");
  await expect(page.getByLabel("Opponent")).toHaveValue(other);

  const column = page.getByTestId(`column-${MY_TEAM}`);
  await expect(column.getByText(/[WL] \d+–\d+/).first()).toBeVisible();
  await expect(column.getByText("GTD")).toHaveCount(0);
  await expect(column.getByText(/Q\d /)).toHaveCount(0);
  expect(await columnValues(page, MY_TEAM)).not.toContain("Out");
  await expectNoHorizontalScroll(page);
});

test("a failed week table shows its error and retry while the rosters still load", async ({
  page,
}) => {
  await signIn(page, "a", "Matchup");
  await setScenario("unavailable");
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId(`column-${MY_TEAM}`)).toBeVisible();

  await setScenario("ok");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("totals-grid")).toBeVisible();
});

for (const day of ["Today", "Week"] as const) {
  test(`${day}: the score card and day bar stay in view while the players scroll`, async ({
    page,
  }) => {
    await signIn(page, "a", "Matchup");
    const days = page.getByRole("navigation", { name: "Day" });
    await days.getByRole("link", { name: day }).click();
    await expect(page.getByTestId("totals-grid")).toBeVisible();
    await expect(page.getByTestId(`column-${MY_TEAM}`)).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByTestId("totals-grid")).not.toBeInViewport();
    await expect(page.getByTestId("matchup-header")).toBeInViewport();
    await expect(days).toBeInViewport();
    // The block sits under the app header, not behind it.
    const header = await page.getByRole("banner").boundingBox();
    const top = await page.getByTestId("matchup-top").boundingBox();
    expect(top?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
    await expectNoHorizontalScroll(page);
  });
}

test("the games-played ⓘ explains the numbers and closes again", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await expect(page.getByTestId("games-played")).toHaveText(/Games played\s*You \d+\/\d+/);
  const info = page.getByRole("button", { name: "What games played means" });
  await expect(page.getByTestId("games-played-info")).toHaveCount(0);

  await info.click();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("games-played-info")).toContainText("games already played");
  await info.click();
  await expect(page.getByTestId("games-played-info")).toHaveCount(0);
});
