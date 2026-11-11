import {
  LEAGUE,
  MY_TEAM,
  TABS,
  openScreen,
  openTab,
  setScenario,
  signIn,
  expect,
  test,
} from "./support";

test.beforeEach(async () => {
  await setScenario("ok");
});

test("signs in with a seeded manager and shows the league rankings", async ({ page }) => {
  await signIn(page);

  await expect(page.getByText(/2025 season/)).toContainText("Team 11");
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
  await expect(page.getByTestId(`row-ranking-${MY_TEAM}`)).toContainText("(you)");
  await expect(page).toHaveURL(new RegExp(`/leagues/${LEAGUE}/teams/${MY_TEAM}/current$`));
});

test("opens on Matchup and keeps the screen and day through refresh and back", async ({ page }) => {
  const base = `/leagues/${LEAGUE}/teams/${MY_TEAM}`;
  await signIn(page, "a", "Matchup");
  await expect(page.getByTestId("player-columns").getByRole("listitem")).toHaveCount(26);

  const days = page.getByRole("navigation", { name: "Day" });
  await days.getByRole("link", { name: "Yesterday" }).click();
  await expect(page).toHaveURL(`${base}/matchup/yesterday`);
  await page.reload();
  await expect(days.getByRole("link", { name: "Yesterday" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByTestId("player-columns")).toBeVisible();

  await days.getByRole("link", { name: "Week" }).click();
  await expect(page.getByTestId("matchup-week")).toContainText("Week 5");

  await openScreen(page, "Players");
  await expect(page).toHaveURL(`${base}/players`);
  await expect(page.getByTestId("players-list").getByRole("listitem")).toHaveCount(25);
  await page.reload();
  await expect(page.getByTestId("players-list")).toBeVisible();

  await openScreen(page, "League");
  await expect(page).toHaveURL(`${base}/current`);
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);

  await page.goBack();
  await expect(page).toHaveURL(`${base}/players`);
  await page.goBack();
  await expect(page).toHaveURL(`${base}/matchup/week`);
  await page.goBack();
  await expect(page).toHaveURL(`${base}/matchup/yesterday`);
  await expect(days.getByRole("link", { name: "Yesterday" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("keeps the selection in the URL: a deep link, another period, and back", async ({ page }) => {
  await signIn(page);

  await page.goto(`/leagues/${LEAGUE}/teams/${LEAGUE}.t.3/season`);
  await expect(page.getByLabel("Viewing as")).toHaveValue(`${LEAGUE}.t.3`);
  await expect(page.getByLabel("Time period")).toHaveValue("season");

  await page.getByLabel("Time period").selectOption("1");
  await expect(page).toHaveURL(/\/1$/);
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);

  await page.goBack();
  await expect(page.getByLabel("Time period")).toHaveValue("season");
});

test("shows the matchup and the comparison against every team", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("Time period").selectOption("1");

  await openTab(page, "matchup");
  await expect(page.getByTestId("matchup-score")).toBeVisible();
  await expect(page.getByTestId(/^matchup-category-/)).toHaveCount(9);
  await expect(page.getByText(/Yahoo decides the official result/)).toBeVisible();

  await openTab(page, "compare");
  await expect(page.getByTestId(/^comparison-/)).toHaveCount(13);
  await page
    .getByTestId(/^comparison-/)
    .first()
    .click();
  await expect(page.getByTestId(/^matchup-category-/)).toHaveCount(9);
  await expect(page.getByText(/not a prediction/)).toBeVisible();
});

test("shows the heatmap and the roster", async ({ page }) => {
  await signIn(page);

  await openTab(page, "heatmap");
  await expect(page.getByTestId(/^row-heatmap-/)).toHaveCount(14);

  await openTab(page, "roster");
  await expect(page.getByText("Derrick White")).toBeVisible();
  await expect(page.getByText(/Roster as of/)).toBeVisible();
});

test("asks before disconnecting and does nothing when cancelled", async ({ page }) => {
  await signIn(page);
  await openTab(page, "account");

  await page.getByRole("button", { name: "Disconnect Yahoo" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("revokes this app's access at Yahoo");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await openTab(page, "rankings");
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
});

test("keeps the table on screen and offers a retry when Yahoo stops answering", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
  await setScenario("unavailable");

  await page.getByRole("button", { name: "Refresh from Yahoo" }).click();

  await expect(page.getByRole("alert")).toContainText("Yahoo isn't responding");
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);

  await setScenario("ok");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toBeHidden();
});

test("refreshes an expired Yahoo token on its own", async ({ page }) => {
  await setScenario("unauthorized");

  await signIn(page);

  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
});

test("never scrolls the page sideways; only the stat tables do", async ({ page }) => {
  await signIn(page);

  for (const tab of TABS) {
    await openTab(page, tab);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `page overflows sideways on the ${tab} tab`).toBeLessThanOrEqual(0);
  }
  for (const screen of ["Matchup", "Players"] as const) {
    await openScreen(page, screen);
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `page overflows sideways on ${screen}`).toBeLessThanOrEqual(0);
  }
});
